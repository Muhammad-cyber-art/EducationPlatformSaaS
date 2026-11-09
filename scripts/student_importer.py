"""
student_importer.py
===================
CRM tizimlari uchun o'quvchilar ro'yxatini Excel/CSV yoki Skrinshot (OCR) rasmlaridan
ajratib oluvchi va DRF backend API'ga avtomatik yuklovchi professional modul va CLI utility.

Muallif: Professional Python & Data Processing Developer
Format: {"first_name": "...", "last_name": "...", "phone": "+998..."}
"""

import os
import re
import sys
import json
import logging
from typing import List, Dict, Optional, Tuple, Any
from pathlib import Path

# Ma'lumotlarni tahlil qilish uchun asosiy kutubxonalar
import pandas as pd
import requests

# Log sozlamalari
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("StudentImporter")


# =============================================================================
# 1. TELEFON RAQAMLARINI O'ZBEKISTON STANDARTIGA NORMALIZATSIYA QILISH
# =============================================================================
def normalize_uz_phone(raw_phone: Any) -> Optional[str]:
    """
    Har qanday formatdagi telefon raqamini O'zbekiston standartiga (+998XXXXXXXXX) keltiradi.
    
    Misollar:
        "+998 (90) 123-45-67" -> "+998901234567"
        "901234567"           -> "+998901234567"
        "998931112233"        -> "+998931112233"
        "8 90 123 45 67"      -> "+998901234567"
        "8901234567"          -> "+998901234567"
    """
    if raw_phone is None or pd.isna(raw_phone):
        return None

    # Satrga o'tkazish va OCR natijasidagi umumiy xatoliklarni to'g'rilash (O -> 0, l -> 1)
    text = str(raw_phone).strip()
    text = text.replace('O', '0').replace('o', '0').replace('l', '1').replace('I', '1')

    # Faqat raqamlarni ajratib olish
    digits = re.sub(r'\D', '', text)

    # 1. 9 ta raqam bo'lsa (masalan: 901234567) -> +998 qo'shiladi
    if len(digits) == 9:
        return f"+998{digits}"

    # 2. 12 ta raqam bo'lsa va 998 bilan boshlansa -> + qo'shiladi
    if len(digits) == 12 and digits.startswith("998"):
        return f"+{digits}"

    # 3. 10 ta raqam bo'lsa va 8 bilan boshlansa (masalan: 8901234567) -> 8 o'rniga +998
    if len(digits) == 10 and digits.startswith("8"):
        return f"+998{digits[1:]}"

    # 4. Agar 11 ta raqam bo'lsa va 8998 bilan boshlansa -> +998 ga to'g'rilanadi
    if len(digits) == 12 and digits.startswith("8998"):
        return f"+{digits[1:]}"

    # 5. Agar uzunligi mos kelmasa — yaroqsiz raqam
    return None


# =============================================================================
# 2. ISM VA FAMILIYANI INTELLEKTUAL PARSING QILISH
# =============================================================================
def parse_name(full_or_first_name: str, last_name: Optional[str] = None) -> Tuple[str, str]:
    """
    Ism va familiyani tozalab, (first_name, last_name) juftligiga ajratadi.
    Agar bitta ustunda to'liq F.I.SH berilgan bo'lsa, avtomatik ajratadi.
    """
    fn = str(full_or_first_name or "").strip()
    ln = str(last_name or "").strip()

    # Agar familiya alohida ustunda berilgan bo'lsa
    if ln:
        return fn, ln

    # Agar bitta ustunda "Valiyev Ali" yoki "Ali Valiyev" ko'rinishida bo'lsa
    parts = fn.split()
    if len(parts) >= 2:
        # O'zbekistonda ko'p jadvallarda Familiya birinchi yoziladi: [Familiya, Ism, Sharif]
        # Ammo umumiy holatda birinchi so'zni Ism, qolganini Familiya (yoki aksincha) qilib olamiz
        return parts[1], parts[0]
    elif len(parts) == 1:
        return parts[0], ""
    return "", ""


# =============================================================================
# 3. EXCEL VA CSV FAYLLARDAN MA'LUMOTLARNI AJRATIB OLISH (PANDAS)
# =============================================================================
def parse_excel_or_csv(file_path: str) -> List[Dict[str, str]]:
    """
    .xlsx, .xls yoki .csv fayllaridan o'quvchilar ro'yxatini o'qib oladi.
    Ustun nomlarini moslashuvchan (fuzzy/case-insensitive) aniqlaydi.
    """
    logger.info(f"Excel/CSV fayl tahlil qilinmoqda: {file_path}")
    ext = Path(file_path).suffix.lower()

    try:
        if ext == '.csv':
            try:
                df = pd.read_csv(file_path, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='cp1251')
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        logger.error(f"Faylni o'qishda xatolik yuz berdi: {e}")
        raise

    if df.empty:
        logger.warning("Fayl bo'sh!")
        return []

    # Ustun nomlarini kichik harflarga o'tkazish va tozalash
    col_map = {str(col).strip().lower(): col for col in df.columns}

    # Ustunlarni aniqlash qoidalari
    first_name_col = None
    last_name_col = None
    full_name_col = None
    phone_col = None

    for col_lower, orig_col in col_map.items():
        # Telefon ustunini aniqlash
        if any(term in col_lower for term in ['tel', 'phone', 'raqam', 'nomer', 'aloqa']):
            phone_col = orig_col
        # Faqat ism ustuni
        elif col_lower in ['ism', 'first_name', 'firstname', 'name', 'first name', 'имя']:
            first_name_col = orig_col
        # Faqat familiya ustuni
        elif col_lower in ['familiya', 'last_name', 'lastname', 'surname', 'last name', 'фамилия']:
            last_name_col = orig_col
        # To'liq ism (F.I.SH)
        elif any(term in col_lower for term in ['f.i.sh', 'fish', 'fio', 'full_name', 'fullname', 'фио', 'o\'quvchi', 'talaba']):
            full_name_col = orig_col

    logger.info(f"Aniqlangan ustunlar: Ism={first_name_col}, Familiya={last_name_col}, FIO={full_name_col}, Tel={phone_col}")

    # Agar aniq ustun nomlari topilmasa, ustun tartibi bo'yicha taxmin qilish
    if not phone_col:
        # Ustunlar ichida telefon raqamga o'xshash qiymatlar bor ustunni qidirish
        for orig_col in df.columns:
            sample_val = str(df[orig_col].dropna().iloc[0] if not df[orig_col].dropna().empty else "")
            if normalize_uz_phone(sample_val):
                phone_col = orig_col
                break

    students = []
    for idx, row in df.iterrows():
        row_num = idx + 2  # Excel'dagi qator raqami (header = 1-qator)

        # Telefon raqamni olish va tozalash
        raw_phone = row.get(phone_col) if phone_col else None
        phone = normalize_uz_phone(raw_phone)

        # Ism va Familiyani olish
        if first_name_col and last_name_col:
            fn = str(row.get(first_name_col, "")).strip()
            ln = str(row.get(last_name_col, "")).strip()
        elif full_name_col:
            fn, ln = parse_name(row.get(full_name_col, ""))
        elif first_name_col:
            fn, ln = parse_name(row.get(first_name_col, ""))
        else:
            # Agar ustun topilmasa, dastlabki matnli ustunlarni olish
            fn, ln = "", ""
            for c in df.columns:
                if c != phone_col:
                    val = str(row[c]).strip()
                    if val and not val.isdigit():
                        fn, ln = parse_name(val)
                        break

        if not fn and not ln and not phone:
            continue  # Bo'sh qator

        if not phone:
            logger.warning(f"{row_num}-qatorda telefon raqam yaroqsiz: '{raw_phone}' (O'quvchi: {fn} {ln})")

        students.append({
            "first_name": fn,
            "last_name": ln,
            "phone": phone or "",
            "_row": row_num
        })

    logger.info(f"Excel/CSV dan jami {len(students)} ta o'quvchi ajratib olindi.")
    return students


# =============================================================================
# 4. SKRINSHOT VA RASMLARDAN MA'LUMOTLARNI AJRATIB OLISH (OCR)
# =============================================================================
def parse_image_ocr(file_path: str) -> List[Dict[str, str]]:
    """
    Rasm (.png, .jpg, .jpeg) jadvalidan EasyOCR yoki Pytesseract yordamida matnni
    ajratib oladi va qatorlarni o'quvchilar ro'yxatiga aylantiradi.
    """
    logger.info(f"Rasm OCR orqali tahlil qilinmoqda: {file_path}")
    students = []

    # 1-variant: EasyOCR (Jadval qatorlarini koordinatalar bo'yicha eng aniq ajratadi)
    try:
        import easyocr
        logger.info("EasyOCR yuklanmoqda...")
        reader = easyocr.Reader(['uz', 'en'], gpu=False)
        ocr_results = reader.readtext(file_path)

        # Matnlarni Y-koordinatasi bo'yicha guruhlash (bitta jadval qatori ~20-30px farq qiladi)
        lines = []
        # ocr_result: [ [ [x1,y1], [x2,y2], [x3,y3], [x4,y4] ], text, confidence ]
        sorted_boxes = sorted(ocr_results, key=lambda b: b[0][0][1])  # Y bo'yicha saralash

        current_line = []
        last_y = None
        y_tolerance = 25  # Bitta qator balandlik chegarasi

        for box, text, conf in sorted_boxes:
            box_y = box[0][1]
            if last_y is None or abs(box_y - last_y) <= y_tolerance:
                current_line.append((box[0][0], text))  # (X, text)
                last_y = box_y
            else:
                # X bo'yicha saralash (chapdan o'ngga)
                current_line.sort(key=lambda item: item[0])
                lines.append(" ".join([t[1] for t in current_line]))
                current_line = [(box[0][0], text)]
                last_y = box_y

        if current_line:
            current_line.sort(key=lambda item: item[0])
            lines.append(" ".join([t[1] for t in current_line]))

        logger.info(f"EasyOCR orqali {len(lines)} ta qator aniqlandi.")

    except ImportError:
        # 2-variant: Fallback sifatida Pytesseract
        logger.warning("EasyOCR o'rnatilmagan. Pytesseract orqali urinib ko'rilmoqda...")
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(file_path)
            raw_text = pytesseract.image_to_string(img, lang='eng+uzb', config='--psm 6')
            lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
            logger.info(f"Pytesseract orqali {len(lines)} ta qator aniqlandi.")
        except ImportError:
            raise ImportError(
                "Rasm bilan ishlash uchun 'easyocr' yoki 'pytesseract' o'rnatilgan bo'lishi shart!\n"
                "Iltimos, terminalda quyidagi buyruqni bering:\n"
                "pip install easyocr  # (yoki: pip install pytesseract pillow)"
            )

    # Qatorlarni tahlil qilish (Parsing lines into students)
    # Telefon qolipi (O'zbekiston raqamlari)
    phone_pattern = re.compile(r'(\+?998[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|\b9\d{8}\b|\b8\d{9}\b)')

    row_index = 1
    for line in lines:
        row_index += 1
        # Agar sarlavha qatori bo'lsa (Ism, Familiya, Tel so'zlari) — o'tkazib yuborish
        lower_line = line.lower()
        if any(h in lower_line for h in ['telefon', 'phone', 'familiya', 'first name', 'f.i.sh']):
            continue

        # Telefon raqamni topish
        phone_match = phone_pattern.search(line)
        if not phone_match:
            # Agar aniq match bo'lmasa, raqamlar ketma-ketligini izlash
            digits_in_line = re.findall(r'\b\d{9,12}\b', line)
            raw_phone = digits_in_line[0] if digits_in_line else None
        else:
            raw_phone = phone_match.group(0)

        phone = normalize_uz_phone(raw_phone)

        # Ismni matndan ajratib olish (telefon va tartib raqamlarini olib tashlash)
        text_without_phone = line
        if raw_phone:
            text_without_phone = text_without_phone.replace(raw_phone, "")

        # Boshdagi tartib raqamlarini tozalash (masalan: "1.", "1 ", "12)")
        clean_name_text = re.sub(r'^\s*\d+[\.\)\-]?\s*', '', text_without_phone).strip()
        # Belgilarni tozalash
        clean_name_text = re.sub(r'[^A-Za-zА-Яа-яЎўҚқҒғҲҳ\s\']', '', clean_name_text).strip()

        if not clean_name_text and not phone:
            continue

        fn, ln = parse_name(clean_name_text)

        students.append({
            "first_name": fn,
            "last_name": ln,
            "phone": phone or "",
            "_row": row_index
        })

    logger.info(f"Rasmdan jami {len(students)} ta o'quvchi ma'lumoti ajratib olindi.")
    return students


# =============================================================================
# 5. ASOSIY YUKLOVCHI (CONTROLLER) VA DRF BACKENDGA POST SO'ROV
# =============================================================================
class StudentDataImporter:
    """
    Faylni aniqlovchi, tozalovchi va DRF backend API'ga yuklovchi boshqaruvchi klass.
    """

    SUPPORTED_EXCEL_EXTS = {'.xlsx', '.xls', '.csv'}
    SUPPORTED_IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}

    def __init__(self, api_url: str, auth_token: Optional[str] = None, tenant_domain: Optional[str] = None):
        """
        Args:
            api_url: DRF Student endpointi (masalan: "http://127.0.0.1:8000/api/students/")
            auth_token: JWT Bearer token (ixtiyoriy)
            tenant_domain: Multi-tenant CRM uchun subdomen (masalan: "najot.crm.uz")
        """
        self.api_url = api_url.rstrip('/') + '/'
        self.session = requests.Session()
        
        # Sarlavhalarni (Headers) sozlash
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        if tenant_domain:
            headers["X-Tenant-Domain"] = tenant_domain

        self.session.headers.update(headers)

    def extract_students(self, file_path: str) -> List[Dict[str, str]]:
        """
        Fayl kengaytmasini aniqlab, mos keluvchi parserni ishga tushiradi.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Fayl topilmadi: {file_path}")

        ext = Path(file_path).suffix.lower()

        if ext in self.SUPPORTED_EXCEL_EXTS:
            return parse_excel_or_csv(file_path)
        elif ext in self.SUPPORTED_IMAGE_EXTS:
            return parse_image_ocr(file_path)
        else:
            raise ValueError(
                f"Qo'llab-quvvatlanmaydigan fayl formati: '{ext}'. "
                f"Faqat quyidagi formatlar qabul qilinadi: {self.SUPPORTED_EXCEL_EXTS | self.SUPPORTED_IMAGE_EXTS}"
            )

    def upload_to_backend(self, students: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Ajratib olingan o'quvchilarni DRF backend API'siga POST so'rov orqali yuboradi.
        Har bir qator holatini tekshiradi va xatolarni konsolga batafsil chiqaradi.
        """
        if not students:
            logger.warning("Yuborish uchun ma'lumotlar mavjud emas.")
            return {"total": 0, "success": 0, "failed": 0, "errors": []}

        logger.info(f"Backend API'ga ({self.api_url}) {len(students)} ta o'quvchini yuborish boshlandi...\n")

        success_count = 0
        failed_count = 0
        errors = []

        for student in students:
            row_num = student.get("_row", "?")
            # Backendga yuboriladigan toza JSON payloadi
            payload = {
                "first_name": student.get("first_name", ""),
                "last_name": student.get("last_name", ""),
                "phone": student.get("phone", "")
            }

            try:
                response = self.session.post(self.api_url, json=payload, timeout=15)

                # Muvaffaqiyatli natija: 200 OK yoki 201 Created
                if response.status_code in (200, 201):
                    success_count += 1
                    logger.info(
                        f" [Qator {row_num}] Qo'shildi: {payload['first_name']} {payload['last_name']} ({payload['phone']})"
                    )
                else:
                    failed_count += 1
                    err_detail = response.text
                    try:
                        err_json = response.json()
                        err_detail = json.dumps(err_json, ensure_ascii=False)
                    except Exception:
                        pass

                    err_msg = f"{row_num}-qatordagi o'quvchini qo'shishda xatolik (HTTP {response.status_code}): {err_detail}"
                    logger.error(f" {err_msg}")
                    errors.append({"row": row_num, "student": payload, "error": err_detail})

            except requests.exceptions.RequestException as req_err:
                failed_count += 1
                err_msg = f"{row_num}-qatordagi o'quvchini qo'shishda tarmoq xatoligi: {req_err}"
                logger.error(f" {err_msg}")
                errors.append({"row": row_num, "student": payload, "error": str(req_err)})

        # Yakuniy hisobot
        print("\n" + "=" * 60)
        print(" YAKUNIY STATISTIKA:")
        print(f" Jami o'quvchilar soni : {len(students)}")
        print(f" Muvaffaqiyatli qo'shildi: {success_count}")
        print(f" Xatolik bilan tugadi   : {failed_count}")
        print("=" * 60 + "\n")

        return {
            "total": len(students),
            "success": success_count,
            "failed": failed_count,
            "errors": errors
        }

    def process_file(self, file_path: str) -> Dict[str, Any]:
        """Barcha jarayonni bitta qadamda bajarish: faylni o'qish va API'ga yuborish."""
        students = self.extract_students(file_path)
        return self.upload_to_backend(students)


# =============================================================================
# 6. CLI BUYRUQLAR SATRI INTERFEYSI (MAIN)
# =============================================================================
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Excel/CSV yoki Rasm (Skrinshot) orqali o'quvchilarni DRF API'ga import qilish dasturi."
    )
    parser.add_argument("-f", "--file", required=True, help="Fayl yo'li (.xlsx, .csv, .png, .jpg)")
    parser.add_argument("-u", "--url", default="http://127.0.0.1:8000/api/students/", help="DRF API endpoint URL manzili")
    parser.add_argument("-t", "--token", default=None, help="JWT Bearer avtorizatsiya tokeni")
    parser.add_argument("-d", "--domain", default=None, help="Tenant domeni (Multi-Tenant CRM uchun, masalan: app.crm.uz)")
    parser.add_argument("--dry-run", action="store_true", help="Faqat o'qish va ekranga chiqarish (API'ga so'rov yubormaydi)")

    args = parser.parse_args()

    importer = StudentDataImporter(
        api_url=args.url,
        auth_token=args.token,
        tenant_domain=args.domain
    )

    try:
        data = importer.extract_students(args.file)

        if args.dry_run:
            print(f"\n[DRY RUN] Aniqlangan o'quvchilar ro'yxati ({len(data)} ta):")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            importer.upload_to_backend(data)

    except Exception as exc:
        logger.critical(f"Kutilmagan xatolik yuz berdi: {exc}", exc_info=True)
        sys.exit(1)


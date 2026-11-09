"""Bounded file extraction and permission-checked student imports.

Extraction never writes to the database. The UI can correct OCR results before
submitting them; every committed row is an independent atomic operation.
"""
import csv
import hashlib
import io
import logging
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata
import zipfile

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from .ocr import OCRUnavailable, OCRBusy, image_slot, resolve_ocr_command, ocr_arguments

logger = logging.getLogger(__name__)
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_ROWS = 500
MAX_COLUMNS = 50
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}


def cell_text(value):
    if value is None or isinstance(value, float) and math.isnan(value):
        return ''
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def normalize_uz_phone(value):
    text = cell_text(value)
    # Excel sometimes exports integral numeric phone cells as "998901234567.0".
    text = re.sub(r'\.0+$', '', text)
    if not re.fullmatch(r'[+\d\s().-]+', text):
        return None
    digits = re.sub(r'\D', '', text)
    if len(digits) == 9:
        return '+998' + digits
    if len(digits) == 12 and digits.startswith('998'):
        return '+' + digits
    if len(digits) == 10 and digits.startswith('8'):
        return '+998' + digits[1:]
    return None


def parse_name(first, last=None):
    first, last = cell_text(first), cell_text(last)
    if last:
        return first, last, f'{last} {first}'.strip()
    parts = first.split()
    return (parts[1], parts[0], first) if len(parts) > 1 else (first, '', first)


def _header(value):
    return re.sub(r'[^\w]', '', cell_text(value).lower())


def _table_students(rows):
    # Buffer a bounded table so row 2 and neighbouring rows can identify columns
    # even when there is no recognised header or a cell is empty.
    table = []
    for number, values in enumerate(rows, 1):
        if number > MAX_ROWS + 21:
            raise ValueError(f'Faylda ko‘pi bilan {MAX_ROWS} ta o‘quvchi bo‘lishi mumkin.')
        if len(values) > MAX_COLUMNS:
            raise ValueError(f'Jadvalda ko‘pi bilan {MAX_COLUMNS} ta ustun bo‘lishi mumkin.')
        table.append((number, [cell_text(value) for value in values]))

    columns = None
    start = 0
    for position, (number, values) in enumerate(table[:20]):
        candidates = _header_columns(values)
        if 'phone' in candidates and ('full' in candidates or 'first' in candidates or 'last' in candidates):
            columns, start = candidates, position + 1
            break
    if columns is None:
        # Prefer row 2 as requested, then allow a headerless first row or a title
        # above the actual list. Never classify an ordinal such as 1 or 25 as a phone.
        probe = table[1:2] + table[:1] + table[2:20]
        for number, values in probe:
            phones = [i for i, value in enumerate(values) if normalize_uz_phone(value)]
            names = [i for i, value in enumerate(values)
                     if sum(character.isalpha() for character in value) > 10
                     and not any(character.isdigit() for character in value)]
            if phones and names:
                columns = {'full': names[0], 'phone': phones[0]}
                if len(phones) > 1:
                    columns['parent_phone'] = phones[1]
                # The first data row must not be lost in a headerless file.
                start = next((i for i, (_, row) in enumerate(table)
                              if _cell(row, names[0]) and normalize_uz_phone(_cell(row, phones[0]))), 0)
                break
    if columns is None:
        raise ValueError('Ism-familiya va telefon ustunlari aniqlanmadi. Ikkinchi qatorda ism-familiya 10 tadan ko‘p harfdan, telefon esa 9 yoki 998 bilan 12 raqamdan iborat bo‘lsin.')

    sample = [values for _, values in table[start:start + 20]]
    detected_phones = [index for index in range(max((len(row) for row in sample), default=0))
                       if any(normalize_uz_phone(_cell(row, index)) for row in sample)]
    if detected_phones and not any(normalize_uz_phone(_cell(row, columns['phone'])) for row in sample):
        # A header named "Raqam" can be an ordinal, not a phone number.
        columns['phone'] = detected_phones[0]
        columns.pop('parent_phone', None)

    # Recognised headers may describe just one of two phone columns. Infer the
    # additional column from real data without relying on its title or position.
    if 'parent_phone' not in columns:
        for _, values in table[start:start + 20]:
            extra = [i for i, value in enumerate(values)
                     if i not in columns.values() and normalize_uz_phone(value)]
            if extra:
                columns['parent_phone'] = extra[0]
                break

    students = []
    for number, values in table[start:]:
        if not any(values):
            continue
        # A repeated header in a printed table is not a student record.
        repeated = _header_columns(values)
        if 'phone' in repeated and any(key in repeated for key in ('full', 'first', 'last')):
            continue
        def get(key):
            return _cell(values, columns.get(key))
        full_name = get('full') or ' '.join(filter(None, [get('last'), get('first')]))
        raw_phone = get('phone')
        if full_name or raw_phone:
            students.append({'row': number, 'full_name': full_name,
                             'phone': normalize_uz_phone(raw_phone) or '', 'raw_phone': raw_phone,
                             'parent_phone': normalize_uz_phone(get('parent_phone')) or '',
                             'raw_parent_phone': get('parent_phone')})
        if len(students) > MAX_ROWS:
            raise ValueError(f'Bir faylda ko‘pi bilan {MAX_ROWS} ta o‘quvchi bo‘lishi mumkin.')
    return students


def _cell(values, index):
    return values[index] if index is not None and index < len(values) else ''


def _header_columns(values):
    columns = {}
    for index, value in enumerate(values):
        key = _header(value)
        if key in {'parentphone', 'otaonatelefoni', 'otaonatelefon', 'otaonatelefonraqami',
                   'otaonaraqami', 'otatelefoni', 'onatelefoni', 'телефонродителя', 'телефонродителей'}:
            columns['parent_phone'] = index
        elif key in {'telefon', 'telefonraqami', 'tel', 'phone', 'phonenumber', 'raqam', 'nomer', 'aloqa', 'телефон', 'номертелефона'}:
            if 'phone' not in columns:
                columns['phone'] = index
            elif 'parent_phone' not in columns:
                columns['parent_phone'] = index
        elif key in {'ism', 'firstname', 'name', 'имя'}:
            columns['first'] = index
        elif key in {'familiya', 'lastname', 'surname', 'фамилия'}:
            columns['last'] = index
        elif key in {'fish', 'fio', 'fullname', 'фио', 'oquvchi', 'talaba', 'ismfamiliya', 'familiyaism'}:
            columns['full'] = index
    return columns


def extract_from_excel_or_csv(file_bytes, filename):
    ext = Path(filename).suffix.lower()
    if ext == '.csv':
        try:
            content = file_bytes.decode('utf-8-sig')
        except UnicodeDecodeError:
            content = file_bytes.decode('cp1251')
        try:
            dialect = csv.Sniffer().sniff(content[:8192], delimiters=',;\t')
        except csv.Error:
            dialect = csv.excel
        return _table_students(csv.reader(io.StringIO(content), dialect))
    if ext == '.xls':
        raise ValueError('Eski .xls faylni Excel dasturida .xlsx formatida saqlab, qayta yuklang.')
    from openpyxl import load_workbook
    try:
        # A small compressed upload must not expand to an unbounded XML archive.
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            if len(archive.infolist()) > 1000 or sum(f.file_size for f in archive.infolist()) > 50 * 1024 * 1024:
                raise ValueError('Excel faylining ochilgan hajmi juda katta.')
        workbook = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        try:
            sheet = workbook.active
            if sheet.max_column and sheet.max_column > MAX_COLUMNS:
                raise ValueError('Excel faylida juda ko‘p ustun bor.')
            # Ignore inflated dimension metadata, but bound iteration ourselves.
            sheet.reset_dimensions()
            return _table_students(sheet.iter_rows(values_only=True))
        finally:
            workbook.close()
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError('Excel faylini o‘qib bo‘lmadi. Haqiqiy .xlsx fayl yuklang.') from exc


def _prepare_ocr_image(image):
    from PIL import Image, ImageDraw, ImageOps, ImageStat

    image = ImageOps.grayscale(image)
    if ImageStat.Stat(image).mean[0] < 127:
        image = ImageOps.invert(image)
    image = ImageOps.autocontrast(image)
    # Long dark runs are spreadsheet borders, not text. Detect them on the
    # original image before enlargement so thin lines do not become thick bars.
    binary = image.point(lambda value: 0 if value < 150 else 255)
    width, height = image.size
    horizontal = [y for y in range(height)
                  if binary.crop((0, y, width, y + 1)).histogram()[0] > width * 0.65]
    vertical = [x for x in range(width)
                if binary.crop((x, 0, x + 1, height)).histogram()[0] > height * 0.65]
    draw = ImageDraw.Draw(image)
    for y in horizontal:
        draw.rectangle((0, max(0, y - 1), width - 1, min(height - 1, y + 1)), fill=255)
    for x in vertical:
        draw.rectangle((max(0, x - 1), 0, min(width - 1, x + 1), height - 1), fill=255)
    scale = min(2, 3200 / max(image.size))
    if scale != 1:
        image = image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)
    logger.info('Student OCR image prepared: size=%sx%s, horizontal_border_pixels=%s, vertical_border_pixels=%s',
                width, height, len(horizontal), len(vertical))
    return ImageOps.expand(image, border=20, fill=255)


def _ocr_lines(file_bytes):
    from PIL import Image, ImageOps, UnidentifiedImageError
    try:
        with Image.open(io.BytesIO(file_bytes)) as source:
            if source.width * source.height > 20_000_000:
                raise ValueError('Rasm 20 megapikseldan katta. Hajmini kichraytiring.')
            image = ImageOps.exif_transpose(source).convert('RGB')
            image.thumbnail((3200, 3200))
            image = _prepare_ocr_image(image)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError('Rasm buzilgan yoki qo‘llab-quvvatlanmaydi.') from exc
    with tempfile.TemporaryDirectory(prefix='student-ocr-') as directory:
        image_path = os.path.join(directory, 'input.png')
        image.save(image_path)
        executable = resolve_ocr_command()
        command = [executable, image_path, 'stdout', *ocr_arguments(executable)]
        try:
            result = subprocess.run(command, capture_output=True, timeout=25, check=True,
                                    env={**os.environ, 'OMP_THREAD_LIMIT': '1'})
        except FileNotFoundError as exc:
            logger.exception('Student OCR executable disappeared: %s', executable)
            raise OCRUnavailable() from exc
        except subprocess.TimeoutExpired as exc:
            raise ValueError('Rasmni o‘qish vaqti tugadi. Kichikroq va tiniqroq rasm yuklang.') from exc
        except subprocess.CalledProcessError as exc:
            logger.warning('Student OCR failed: %s', exc.stderr[:1000])
            raise OCRUnavailable('OCR xizmati rasmni o‘qiy olmadi. Administrator serverdagi OCR sozlamalarini tekshirishi kerak.') from exc
        except OSError as exc:
            logger.exception('Student OCR executable could not start: %s', executable)
            raise OCRUnavailable() from exc
    lines = result.stdout.decode('utf-8', errors='replace').splitlines()
    logger.info('Student OCR completed: nonempty_lines=%s', sum(bool(line.strip()) for line in lines))
    return lines


def extract_from_image_ocr(file_bytes):
    if not image_slot.acquire(blocking=False):
        raise OCRBusy()
    try:
        return _extract_from_image_ocr(file_bytes)
    finally:
        image_slot.release()


def _extract_from_image_ocr(file_bytes):
    lines = _ocr_lines(file_bytes)
    if not any(line.strip() for line in lines):
        raise ValueError('Rasmdan matn o‘qilmadi. Jadvalni yaqinroq, tiniq va to‘g‘ri holatda suratga oling.')
    table = [re.split(r'\s*\|\s*|\t+| {2,}', line.strip().strip('|')) for line in lines]
    if any(len(row) > 1 for row in table):
        try:
            parsed = _table_students(table)
            parsed = [row for row in parsed if sum(c.isalpha() for c in row['full_name']) >= 2]
            if parsed:
                logger.info('Student OCR table parsed: rows=%s, valid_phones=%s',
                            len(parsed), sum(bool(row['phone']) for row in parsed))
                return parsed
        except ValueError:
            # Plain lists and tightly spaced images may not preserve columns.
            # In that case identify phone spans and the remaining name per row.
            pass
    # Include all nine-digit local numbers, not just those beginning with 9.
    phone_pattern = re.compile(r'(?<!\d)(?:\+?998[\s().-]*)?(?:\d[\s().-]*){8}\d(?!\d)')
    students = []
    for number, line in enumerate(lines, 1):
        match = phone_pattern.search(line)
        if not match:
            continue
        matches = list(phone_pattern.finditer(line))
        raw_phone = matches[0].group()
        parent_phone = matches[1].group() if len(matches) > 1 else ''
        name = phone_pattern.sub(' ', line)
        name = re.sub(r'^\s*[\d.)|\-]+\s*', '', name)
        name = ''.join(c for c in name if c.isalpha() or c.isspace() or c in "'’‘ʻʼ`-")
        name = ' '.join(name.split())
        students.append({'row': number, 'full_name': name,
                         'phone': normalize_uz_phone(raw_phone) or '', 'raw_phone': raw_phone,
                         'parent_phone': normalize_uz_phone(parent_phone) or '',
                         'raw_parent_phone': parent_phone})
        if len(students) > MAX_ROWS:
            raise ValueError(f'Ko‘pi bilan {MAX_ROWS} ta o‘quvchi yuklang.')
    if not students:
        logger.warning('Student OCR text had no identifiable student rows: lines=%s', len(lines))
        raise ValueError('Rasmdagi matn o‘qildi, lekin ism va telefonlar ajratilmadi. Telefon raqamlari tiniq ko‘rinishi kerak; ustun nomlari majburiy emas.')
    logger.info('Student OCR plain list parsed: rows=%s', len(students))
    return students


def extract_students(file_bytes, filename):
    if not file_bytes or len(file_bytes) > MAX_FILE_BYTES:
        raise ValueError('Fayl bo‘sh yoki 10 MB dan katta.')
    ext = Path(filename).suffix.lower()
    if ext in {'.xlsx', '.xls', '.csv'}:
        students = extract_from_excel_or_csv(file_bytes, filename)
    elif ext in IMAGE_EXTENSIONS:
        students = extract_from_image_ocr(file_bytes)
    else:
        raise ValueError('Faqat .xlsx, .csv, .png, .jpg, .jpeg, .webp yoki .bmp yuklang.')
    if not students:
        raise ValueError('O‘quvchilar topilmadi. Jadval sarlavhasini yoki rasm tiniqligini tekshiring.')
    return students


def resolve_import_target(user, branch_id=None, group_id=None):
    from branches.models import Branch
    from groups.models import Group
    from permissions.scopes import allowed_branch_ids
    def positive_id(value):
        if value in (None, ''):
            return None
        if isinstance(value, bool) or not re.fullmatch(r'[1-9]\d*', str(value)):
            raise ValueError('Filial va guruh ID si musbat butun son bo‘lishi kerak.')
        value = int(value)
        if value > 9223372036854775807:
            raise ValueError('Filial yoki guruh ID si noto‘g‘ri.')
        return value
    branch_id, group_id = positive_id(branch_id), positive_id(group_id)
    if user.role not in {'super_admin', 'admin', 'mentor'}:
        raise PermissionDenied('O‘quvchi import qilishga ruxsat yo‘q.')
    if user.role == 'mentor':
        permission = (getattr(getattr(user, 'staff_permissions', None), 'permissions', None) or {}).get('students')
        if permission is not True and not (isinstance(permission, list) and 'create' in permission):
            raise PermissionDenied('O‘quvchi yaratish ruxsati kerak.')
    group = Group.objects.filter(pk=group_id).select_related('branch').first() if group_id else None
    if group_id and not group:
        raise ValueError('Tanlangan guruh topilmadi.')
    if group and (group.is_archived or not group.is_faol):
        raise ValueError('Arxivlangan yoki nofaol guruhga import qilib bo‘lmaydi.')
    if group and branch_id and group.branch_id != branch_id:
        raise ValueError('Tanlangan guruh boshqa filialga tegishli.')
    branch_id = group.branch_id if group else branch_id or user.branch_id
    if user.role != 'super_admin' and branch_id not in allowed_branch_ids(user):
        raise PermissionDenied('Ushbu filialga o‘quvchi qo‘shishga ruxsat yo‘q.')
    branch = group.branch if group else Branch.objects.filter(pk=branch_id).first()
    if not branch:
        raise ValueError('Mavjud filial yoki guruhni tanlang.')
    return branch, group


def _name_key(value):
    return re.sub(r"[\s'’‘ʻʼ`-]+", '', unicodedata.normalize('NFKC', value).casefold())


def _lock_phone(phone):
    # Student.phone is intentionally not unique (siblings may share a number).
    # Serialize import decisions for this phone across groups and workers.
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SELECT current_schema()')
            key = f'{cursor.fetchone()[0]}:student-import:{phone}'
            lock_id = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], 'big', signed=True)
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [lock_id])


def import_student_rows(rows, branch, group, request):
    from groups.models import Student, GroupEnrollment
    from groups.serializers import StudentSerializer
    from finance.models import Payment
    from finance.utils import floor_amount, calculate_attendance_based_student_payment
    if not isinstance(rows, list) or not rows or len(rows) > MAX_ROWS:
        raise ValueError(f'1 tadan {MAX_ROWS} tagacha o‘quvchi yuboring.')
    if any(not isinstance(item, dict) for item in rows):
        raise ValueError('Har bir o‘quvchi ma’lumoti obyekt bo‘lishi kerak.')
    created, existing, failed = [], [], []
    for number, item in enumerate(rows, 1):
        name = ' '.join(cell_text(item.get('full_name')).split())
        entered_phone = item.get('phone', item.get('raw_phone', ''))
        raw_phone = cell_text(entered_phone) or cell_text(item.get('raw_phone'))
        phone = normalize_uz_phone(entered_phone)
        # The submitted optional field is authoritative; never restore a blank
        # or omitted parent phone from the original OCR/Excel value.
        entered_parent_phone = item.get('parent_phone')
        raw_parent_phone = cell_text(entered_parent_phone)
        if re.fullmatch(r'[-–—]+|[xX]+', raw_parent_phone):
            entered_parent_phone = raw_parent_phone = ''
        parent_phone = normalize_uz_phone(entered_parent_phone)
        row = item.get('row', number)
        if not isinstance(row, int) or isinstance(row, bool) or row < 1:
            row = number
        try:
            if not isinstance(item.get('full_name'), str) or not name or len(name) > 200 or not any(c.isalpha() for c in name):
                raise ValueError('Ism-familiya 1–200 belgidan iborat bo‘lishi kerak.')
            if not phone:
                raise ValueError('Telefon raqami noto‘g‘ri. +998XXXXXXXXX formatidan foydalaning.')
            if raw_parent_phone and not parent_phone:
                raise ValueError('Ota-ona telefon raqami noto‘g‘ri. +998XXXXXXXXX formatidan foydalaning.')
            with transaction.atomic():
                _lock_phone(phone)
                matches = list(Student.objects.select_for_update().filter(phone__in=[phone, phone[1:], phone[4:]])[:3])
                if matches:
                    if len(matches) != 1:
                        raise ValueError('Ushbu raqam bir nechta o‘quvchida bor. Profil orqali biriktiring.')
                    student = matches[0]
                    if student.branch_id != branch.id:
                        raise ValueError('Ushbu raqam bilan boshqa filialda yozuv bor. Administrator orqali tekshiring.')
                    if student.is_archived or not student.is_active:
                        raise ValueError('O‘quvchi arxivda yoki nofaol. Avval profilini tiklang.')
                    if _name_key(student.full_name) != _name_key(name):
                        raise ValueError('Telefon bazada boshqa ism bilan mavjud. Ism va raqamni tekshiring.')
                    if not group:
                        raise ValueError('O‘quvchi bazada allaqachon mavjud.')
                    if parent_phone and not student.parent_phone:
                        student.parent_phone = parent_phone
                        student.save(update_fields=['parent_phone'])
                    enrollment, _ = GroupEnrollment.objects.get_or_create(student=student, group=group)
                    if not enrollment.is_active or enrollment.left_at:
                        enrollment.is_active, enrollment.left_at = True, None
                        enrollment.save(update_fields=['is_active', 'left_at'])
                    if not student.group_id:
                        Student.objects.filter(pk=student.pk).update(group=group)
                    # Match manual student creation: full monthly fee, no rewrite
                    # of an existing invoice or previously paid amounts.
                    month = timezone.localdate().replace(day=1)
                    amount = group.monthly_price
                    if student.status == 'discount':
                        amount = calculate_attendance_based_student_payment(student, group, month)
                    elif student.status in {'low_income', 'negotiated', 'teacher_negotiated'} and not (student.status == 'negotiated' and group.group_type == 'advanced'):
                        amount = student.custom_fee or 0
                    Payment.objects.get_or_create(student=student, group=group, month=month,
                                                  defaults={'amount': floor_amount(amount), 'is_paid': False})
                    target = existing
                else:
                    student = StudentSerializer(context={'request': request}).create({
                        'full_name': name, 'phone': phone, 'parent_phone': parent_phone or '',
                        'group': group, 'branch_id': branch.pk,
                    })
                    target = created
            target.append({'id': student.pk, 'full_name': student.full_name, 'phone': phone,
                           'parent_phone': student.parent_phone or '',
                           'group_name': group.name if group else None})
        except ValueError as exc:
            failed.append({'row': row, 'name': name, 'phone': raw_phone,
                           'parent_phone': raw_parent_phone, 'reason': str(exc)})
        except Exception:
            logger.exception('Student import failed at row %s', number)
            failed.append({'row': row, 'name': name, 'phone': raw_phone,
                           'parent_phone': raw_parent_phone,
                           'reason': 'Saqlashda xatolik. Ushbu qator saqlanmadi; qayta urinib ko‘ring.'})
    return {'success': bool(created or existing), 'total_found': len(rows),
            'created_count': len(created), 'existing_count': len(existing), 'failed_count': len(failed),
            'created_students': created + existing, 'failed_students': failed,
            'message': f'{len(created)} ta yangi, {len(existing)} ta mavjud o‘quvchi; {len(failed)} ta xato qator.'}


def import_students_from_file(file_bytes, filename, branch_id, group_id, request):
    branch, group = resolve_import_target(request.user, branch_id, group_id)
    return import_student_rows(extract_students(file_bytes, filename), branch, group, request)

# O‘quvchilarni rasm yoki Excel orqali qo‘shish

## Foydalanish

1. O‘quvchi qo‘shish sahifasida **Rasm yoki fayl orqali o‘quvchi qo‘shish** tugmasini bosing.
2. Guruh sahifasidan kirilgan bo‘lsa guruh avtomatik olinadi. Boshqa holatda modalda guruhni tanlang. Guruh tanlanmasa faqat filialga qo‘shiladi.
3. `.xlsx`, `.csv`, `.png`, `.jpg`, `.jpeg`, `.webp` yoki `.bmp` yuklang; mobil kameradan ham foydalanish mumkin. Eski `.xls` faylni Excel dasturida `.xlsx` qilib saqlang.
4. O‘qilgan ro‘yxatdagi ism va telefonlarni tekshirib tuzating yoki ortiqcha qatorni olib tashlang. Bu bosqichda baza o‘zgarmaydi.
5. **Tasdiqlash va saqlash** tugmasini bosing. Xato qatorlar sabab bilan chiqadi; faqat shu qatorlarni tuzatib qayta yuborish mumkin.

Excel/CSV namunasi:

```csv
Ism,Familiya,Telefon
Ali,Valiyev,901234567
Gani,Karimov,+998331234567
```

`F.I.SH,Telefon` ham ishlaydi. UTF-8 BOM, Windows-1251, vergul/nuqtali vergul/tab bilan ajratilgan CSV, ruscha sarlavhalar va Excel’dagi son ko‘rinishidagi telefonlar qo‘llab-quvvatlanadi. Excel’ning faol varag‘i o‘qiladi.

Ustunlar qat’iy tartibga bog‘lanmagan. Tanish sarlavhalar bo‘lsa ular ishlatiladi;
sarlavha noma’lum yoki yo‘q bo‘lsa avval ikkinchi qatordagi ma’lumot tekshiriladi.
10 tadan ko‘p harfdan iborat, raqamsiz katak ism-familiya ustuni sifatida olinadi.
Ikkinchi qator bo‘sh bo‘lsa dastlabki 20 qatordan namuna izlanadi. Sarlavhasiz
faylning birinchi o‘quvchisi ham importga kiritiladi.

Telefon ustunlari haqiqiy raqam uzunligi bo‘yicha aniqlanadi (mahalliy 9 raqam
yoki `998` bilan 12 raqam; `+`, bo‘shliq, qavs, tire ham qabul qilinadi).
`1`, `2`, `25` kabi tartib raqamlari telefon hisoblanmaydi. Sarlavha yo‘q bo‘lsa,
chapdan birinchi telefon o‘quvchiga, ikkinchisi ota-onaga tegishli. Tanish
`Ota-ona telefoni` / `parent_phone` sarlavhasi bo‘lsa, uning ma’nosi saqlanadi.
Masalan quyidagi tartib ham qabul qilinadi:

```csv
ID,Aloqa 1,Shaxs,Aloqa 2
1,901234567,Abdullayev Sardor,937654321
```

Rasmda OCR ustunlar orasidagi bo‘shliqlarni saqlashga urinadi. Ustunlar ajralmasa,
har bir satrdagi telefonlar chapdan o‘ngga ajratiladi; qolgan harfli matn ism
sifatida ko‘rsatiladi. Ota-ona telefoni preview jadvalida tahrirlanadi, tasdiqlashda
tekshiriladi va yangi o‘quvchiga saqlanadi. Mavjud o‘quvchining ota-ona telefoni
bo‘sh bo‘lsa to‘ldiriladi; mavjud raqam avtomatik almashtirilmaydi.

OCR oldidan rasm kulrangga o‘tkaziladi, kontrast tekislanadi, uzun gorizontal va
vertikal katak chiziqlari tozalanadi. Matn ko‘pi bilan 2 marta kattalashtiriladi,
asosiy rasmning uzun tomoni 3200 piksel bilan cheklanadi va chetiga oq joy qo‘shiladi.
Katak chiziqli jadvalda oldingi OCR rejimi qatorlarni yo‘qotishi lokal sinovda
takrorlandi. Yangi regressiya testi katakli, mayda shriftli va 50% kichraytirilgan
uchta rasmda ikki o‘quvchining ismi va ikkala telefonini haqiqiy Tesseract bilan
tekshiradi. Bu sun’iy sinov suratlari; foydalanuvchining haqiqiy surati hali
tekshirilmagan. Qiyshiq, xira, qo‘lyozma yoki bir necha satrga bo‘lingan kataklar
uchun natijani preview’da asl rasm bilan solishtirish kerak.

Server logida rasm o‘lchami, tozalangan chiziqlar, OCR satrlari va ajratilgan
o‘quvchilar soni yoziladi; OCR matni va telefonlar diagnostika logiga chiqarilmaydi.

## Saqlash qoidalari

- Guruh va filial mosligi hamda foydalanuvchi ruxsatlari fayl o‘qilishidan oldin va tasdiqlashda qayta tekshiriladi. Mentor uchun `students: true` yoki `students: ["create", ...]` kerak; filial ruxsatlari ham tekshiriladi.
- Har bir qator alohida tranzaksiya: o‘quvchi, wallet, enrollment yoki invoice xatosida shu qatorning barcha yozuvlari bekor qilinadi. Boshqa to‘g‘ri qatorlar saqlanadi.
- Mavjud o‘quvchi faqat yagona mos telefon, bir xil ism va bir xil filial bo‘lsa biriktiriladi. Boshqa filial, arxiv yoki bir nechta mos profil holati avtomatik birlashtirilmaydi; profil orqali tekshirish kerak.
- Mavjud boshqa guruhlar saqlanadi. Nofaol enrollment qayta faollashadi. Takroriy import ayni guruhda student/enrollment/invoice nusxasini yaratmaydi. PostgreSQL advisory lock bir telefonning parallel importlarini tenant doirasida ketma-ket bajaradi; bu qo‘lda yaratish endpointiga global telefon unikalligi qoidasini kiritmaydi.
- Joriy oy uchun to‘lov varaqasi qo‘lda yangi o‘quvchi yaratishdagi narx qoidasi bilan yaratiladi. Mavjud invoice va to‘langan summalar o‘zgarmaydi. Import pul tushumi yozmaydi.
- Limitlar: 10 MB fayl, 500 o‘quvchi, 50 ustun, 50 MB ochilgan XLSX arxivi, 20 megapiksel rasm. OCR 25 soniyada to‘xtatiladi va bir CPU oqimidan foydalanadi.

## OCR’ni serverda ishga tushirish

Windows lokal muhitida `backend/.tools/tesseract/tesseract.exe` mavjud bo‘lsa,
backend uni har bir rasm so‘rovida avtomatik aniqlaydi. Standart `tesseract`
sozlamasi bilan ham lokal nusxa topiladi; `STUDENT_OCR_COMMAND` maxsus yo‘lga
o‘rnatilgan bo‘lsa, aynan shu nusxa ishlatiladi. Til modellari shu papkadagi
`tessdata` ichida bo‘lishi kerak; ular `--tessdata-dir` bilan aniq ko‘rsatiladi.
Executable yoki til modellari yetishmasa HTTP 503 qaytadi, diagnostika esa
server logiga yoziladi. Buzilgan fayl va foydalanuvchi kiritgan noto‘g‘ri
ma’lumot uchun HTTP 400 saqlanadi.
`.tools/` Git va Docker build kontekstiga kiritilmaydi. OCR fayllari birinchi marta
qo‘shilgandan keyin backendni qayta ishga tushiring.

2026-11-07: lokal Windows uchun Tesseract 5.4.0 fayllari loyiha ichiga ochildi,
`eng`, `uzb`, `rus` modellari tekshirildi. Haqiqiy Tesseract bilan yaratilgan PNG
rasmdagi ikki o‘quvchining ismi va telefoni muvaffaqiyatli o‘qildi (mock ishlatilmadi).

`backend/Dockerfile` Tesseract va `eng`, `uzb`, `rus` til paketlarini o‘rnatadi. Backend image’ni qayta build qilish va frontendni yangilash kerak; eski container’ni shunchaki restart qilish OCR’ni o‘rnatmaydi. Bu funksiyaning o‘zi yangi DB migratsiya talab qilmaydi.

Docker ishlatilmasa Tesseract va shu til paketlarini serverga o‘rnating. Windows’da executable yo‘li PATH’da bo‘lmasa backend `.env` ichida:

```dotenv
STUDENT_OCR_COMMAND=C:/Program Files/Tesseract-OCR/tesseract.exe
STUDENT_OCR_LANGUAGES=eng+uzb+rus
```

Serverda `tesseract --list-langs` orqali tillarni tekshiring. OCR modeli har so‘rovda yuklab olinmaydi, rasm tashqi servisga yuborilmaydi. Kamera suratining EXIF yo‘nalishi tuzatiladi, vaqtinchalik rasm ishlovdan keyin o‘chiriladi. Har bir qatorda ism-familiya va telefon bo‘lishi kerak; telefon topilmagan OCR qatori chiqarilmaydi. Shuning uchun saqlashdan oldingi ro‘yxatni asl surat bilan solishtirish zarur.

## API va tekshiruv

`POST /api/groups/students/import-file/`:

- Multipart `mode=preview`, `file`, `branch_id`/`group_id`: `students`, `branch_id`, `group_id` qaytadi, bazaga yozmaydi.
- JSON `mode=confirm`, `students: [{row, full_name, phone, parent_phone}]`, `branch_id`/`group_id`: qatorlar saqlanadi (`parent_phone` ixtiyoriy).
- Oldingi mijozlar uchun multipart fayl bilan `mode=import` (default) ham ishlaydi.
- Yakunlangan batch, barcha qatorlari xato bo‘lsa ham, HTTP 200 va `failed_students` beradi. Fayl/target xatosi 400, ruxsat xatosi 403. Natijani faqat HTTP kodi bo‘yicha emas, `created_count`, `existing_count`, `failed_count` orqali ko‘rsating.

```powershell
cd backend
.\venv\Scripts\python.exe manage.py test groups.tests_import --settings=config.test_settings
```

Testlar haqiqiy XLSX/CSV fayllarini, rasmni PIL bilan ochishni, OCR chaqiruv parametrlarini, preview/confirm, filial ruxsatlari, qayta import, qisman xato, tranzaksiya rollback va PostgreSQL’da parallel importni qamrab oladi. Avtomatik testlarda OCR javobi mock bilan almashtiriladi. Qo‘shimcha lokal tekshiruvda haqiqiy Tesseract yaratilgan PNG rasmdagi ikki o‘quvchini to‘g‘ri o‘qidi. Foydalanuvchi suratlarining aniqligi va Docker image build’i bu tekshiruv bilan tasdiqlanmagan.

Yakuniy tekshiruv: izolyatsiyalangan PostgreSQL 18 bazasida backendning barcha **164 testi** o‘tdi (import uchun 33 ta test). Frontend production build, yangi modal ESLint tekshiruvi, Django system check va migration drift tekshiruvi ham o‘tdi. Production bazaga murojaat qilinmadi; vaqtinchalik test serveri to‘xtatilib, fayllari tozalandi.

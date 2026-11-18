# Educational Platform Backend

Django REST Framework asosida qurilgan ta'lim platformasi backend qismi.

## 🔒 Xavfsizlik Yaxshilanishlari

Ushbu loyihada quyidagi xavfsizlik choralari qo'llanilgan:

### 1. Environment Variables
- Barcha maxfiy ma'lumotlar (SECRET_KEY, TELEGRAM_BOT_TOKEN) `.env` faylida saqlanadi
- `.env` fayl `.gitignore` da qo'shilgan va git'ga tushmayd
- `.env.example` faylida namuna ko'rsatilgan

### 2. Security Headers
- XSS (Cross-Site Scripting) himoyasi
- Clickjacking himoyasi
- Content-Type sniffing himoyasi
- HTTPS majburiy (production uchun)
- HSTS (HTTP Strict Transport Security)

### 3. Rate Limiting
- Login va register endpointlarga rate limiting qo'shilgan
- Har bir IP dan 1 daqiqada maksimal 10 ta so'rov

### 4. Request Logging
- Barcha POST, PUT, PATCH, DELETE so'rovlar loglanadi
- Xatolar alohida `logs/security.log` faylida saqlanadi
- Audit uchun IP address va user ma'lumotlari yoziladi

### 5. Input Validation
- Password kamida 8 ta belgidan iborat bo'lishi kerak
- Username XSS hujumlaridan himoyalangan
- Django ORM orqali SQL Injection oldini olish

### 6. CORS Configuration
- Faqat ruxsat berilgan originlarga kirish
- Environment variable orqali boshqariladi

## 📦 O'rnatish

1. Virtual environment yarating:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

2. Paketlarni o'rnating:
```bash
pip install -r requirements.txt
```

3. `.env` faylini sozlang:
```bash
copy .env.example .env
# .env faylini tahrirlang va o'z qiymatlaringizni kiriting
```

4. Migratsiyalarni bajaring:
```bash
python manage.py migrate
```

5. Serverni ishga tushiring:
```bash
python manage.py runserver
```

## 🚀 Production uchun

Production muhitda quyidagilarni amalga oshiring:

1. **DEBUG=False** qiling `.env` faylida
2. **SECRET_KEY** ni yangi, kuchli qiymatga o'zgartiring
3. **ALLOWED_HOSTS** ga production domeningizni qo'shing
4. **HTTPS** ni yoqing (SSL sertifikat)
5. **PostgreSQL** yoki boshqa ishonchli database ishlatting (SQLite emas)
6. **Gunicorn** yoki **uWSGI** ishlatting
7. **Nginx** reverse proxy sifatida sozlang
8. **Firewall** sozlang
9. **Backup** tizimini o'rnating

### Production .env namunasi:
```env
SECRET_KEY=your-very-strong-secret-key-here-min-50-chars
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
TELEGRAM_BOT_TOKEN=your-production-bot-token
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

## 📝 Loglar

Loglar `logs/` papkasida saqlanadi:
- `django.log` - umumiy xatolar va warning'lar
- `security.log` - xavfsizlik bilan bog'liq hodisalar

## 🔐 Xavfsizlik Checklist

- [x] Environment variables ishlatiladi
- [x] SECRET_KEY maxfiy
- [x] DEBUG=False production uchun
- [x] HTTPS majburiy (production)
- [x] Security headers qo'shilgan
- [x] Rate limiting mavjud
- [x] Request logging yoqilgan
- [x] Input validation qo'shilgan
- [x] CORS to'g'ri sozlangan
- [x] Password validation mavjud
- [x] SQL Injection himoyasi (Django ORM)
- [x] XSS himoyasi
- [x] CSRF himoyasi (Django default)

## 📞 Qo'shimcha Ma'lumot

Xavfsizlik muammolarini topgan bo'lsangiz, iltimos darhol xabar bering!

## 📄 Litsenziya

[Your License Here]


## CEO tenant workflow deployment

Apply the shared-schema migration before deploying the updated CEO frontend:

```sh
python manage.py migrate --noinput
```

Migration `tenants.0003_impersonationgrant` stores hashed, single-use login codes.
The CEO issues a 60-second code; the tenant exchanges it at
`POST /api/v1/auth/impersonation/exchange/`. The frontend carries the code in the
URL fragment, removes it immediately, and receives JWTs in the POST response.
Expired grants are removed by the existing `cleanup_expired_tokens` task.

Every tenant hostname (including localhost aliases) must have an exact `Domain`
record. Routing no longer guesses tenants from partial schema names or cached
model instances. The reverse proxy must preserve the original validated `Host`.
Only DEBUG requests to localhost may use `X-Tenant-Domain` for development.
The existing subscription expiry and usage enforcement behavior is unchanged.

Validation:

```sh
python manage.py test tenants authenticatsiya.tests.CrossTenantAuthSecurityTests --settings=config.test_settings --noinput
python manage.py test tenants --settings=config.test_postgres_settings --noinput
```

The PostgreSQL lifecycle test uses only the isolated test database and verifies
that a retained schema cannot be reassigned when recreating a deleted tenant.


## Blocked tenant page admission

`GET /api/v1/public/tenants/access/` returns uncached 204 for an active registered
host (or the central platform), and 403 for blocked or unknown tenant hosts.
It requires no JWT and does not activate a tenant database schema.

The Vite development server and production reverse proxy deny tenant HTML before
serving the SPA. The React admission gate also checks before mounting CRM routes,
reacts immediately to `TENANT_INACTIVE`, and rechecks every 15 seconds and on focus.
Public JS/CSS and service-worker updates remain available. HTML is no longer
precached or served through the PWA navigation fallback. If admission cannot be
verified, tenant routes stay closed, including offline starts.

Deploy backend and frontend together, then validate and reload the reverse proxy:

```sh
docker compose up -d --build web frontend
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

No database migration is needed for page admission. Existing clients need the
updated frontend/service worker before the client-side guard can take effect.

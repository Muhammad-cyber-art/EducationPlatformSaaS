"""
create_ceo_user — Platform CEO foydalanuvchisini yaratish.

Bu command tenants.CEOUser modeliga yozuv qo'shadi.
authenticatsiya.UserModel ga HECH QANDAY ta'sir qilmaydi.

Ishlatish:
    python manage.py create_ceo_user \\
        --email="ceo@platform.uz" \\
        --password="SecurePass123!" \\
        --full-name="Ahmad Karimov" \\
        --phone="+998901234567"

    # Interaktiv rejim
    python manage.py create_ceo_user
"""

import getpass

from django.core.management.base import BaseCommand, CommandError

from tenants.models import CEOUser


class Command(BaseCommand):
    help = (
        "Platform CEO foydalanuvchisini yaratadi (tenants.CEOUser). "
        "Bu authenticatsiya.UserModel (super_admin) dan BUTUNLAY FARQLI — "
        "u o'quv markaz direktori, bu esa butun platformani boshqaradi."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email",     type=str, help="CEO email manzili")
        parser.add_argument("--password",  type=str, help="CEO paroli")
        parser.add_argument("--full-name", type=str, default="", dest="full_name", help="To'liq ismi")
        parser.add_argument("--phone",     type=str, default="", help="Telefon raqami")
        parser.add_argument("--no-input",  action="store_true", help="Interaktiv so'rovlarsiz")

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "\n=== CEO Super Admin User Yaratish ===\n"
                "    (tenants.CEOUser -- Public Schema)\n"
            )
        )
        self.stdout.write(
            self.style.WARNING(
                "  [INFO] Bu foydalanuvchi platform CEO paneli uchun yaratiladi.\n"
                "  authenticatsiya.UserModel (o'quv markaz direktori) bilan\n"
                "  hech qanday aloqasi yo'q -- bu butunlay alohida modeldir.\n"
            )
        )

        no_input = options.get("no_input", False)

        # ── Parametrlarni olish ───────────────────────────────────────────────
        email     = options.get("email")     or self._ask("CEO email", no_input)
        full_name = options.get("full_name", "")
        phone     = options.get("phone", "")
        password  = options.get("password")  or self._ask_password(no_input)

        email = email.lower().strip()

        # ── Mavjudligini tekshirish ───────────────────────────────────────────
        if CEOUser.objects.filter(email=email).exists():
            raise CommandError(
                f"'{email}' email manzili bilan CEO foydalanuvchi allaqachon mavjud.\n"
                "  Boshqa email tanlang yoki mavjud foydalanuvchi parolini tiklang."
            )

        # ── Yaratish ─────────────────────────────────────────────────────────
        try:
            ceo = CEOUser.objects.create(
                email=email,
                full_name=full_name.strip(),
                phone=phone.strip() or None,
                is_active=True,
            )
            ceo.set_password(password)
            ceo.save()

            self.stdout.write(
                self.style.SUCCESS(
                    f"\n[OK] CEO foydalanuvchi muvaffaqiyatli yaratildi!\n"
                    f"{'-' * 45}\n"
                    f"  ID       : {ceo.id}\n"
                    f"  Email    : {ceo.email}\n"
                    f"  Ism      : {ceo.full_name or '(berilmagan)'}\n"
                    f"  Telefon  : {ceo.phone or '(berilmagan)'}\n"
                    f"  Jadval   : public.tenants_ceouser\n"
                    f"{'-' * 45}\n"
                    f"  Login    : /ceo/login -> {ceo.email}\n"
                    f"  [!] Parolni xavfsiz joyda saqlang!\n"
                )
            )

        except Exception as exc:
            raise CommandError(f"Yaratishda xatolik: {exc}") from exc

    def _ask(self, prompt: str, no_input: bool) -> str:
        if no_input:
            raise CommandError(f"--no-input rejimida '--{prompt.lower().replace(' ', '-')}' parametri talab qilinadi.")
        value = input(f"  {prompt}: ").strip()
        if not value:
            raise CommandError(f"'{prompt}' bo'sh bo'lishi mumkin emas.")
        return value

    def _ask_password(self, no_input: bool) -> str:
        if no_input:
            raise CommandError("--no-input rejimida --password parametri talab qilinadi.")
        pwd = getpass.getpass("  Parol (kamida 8 belgi): ").strip()
        if len(pwd) < 8:
            raise CommandError("Parol kamida 8 belgidan iborat bo'lishi kerak.")
        confirm = getpass.getpass("  Parolni tasdiqlang: ").strip()
        if pwd != confirm:
            raise CommandError("Parollar mos kelmadi.")
        return pwd

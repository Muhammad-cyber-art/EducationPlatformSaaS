"""
create_tenant_superuser — Ma'lum bir tenant (o'quv markaz) schemasi ichida super_admin yaratish.

Ishlatish:
    # Interaktiv rejim (mavjud tenantlar ro'yxatidan tanlanadi)
    python manage.py create_tenant_superuser

    # CLI parametrlari bilan
    python manage.py create_tenant_superuser \\
        --tenant="everest" \\
        --username="boss" \\
        --email="admin@everest.uz" \\
        --password="SecurePassword123!" \\
        --full-name="Alisher Qodirov" \\
        --phone="+998901234567"
"""

import getpass
import logging
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from tenants.models import Tenant
from tenants.utils import set_search_path, reset_search_path

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Kerakli tenant (o'quv markaz) schemasi ichida yangi super_admin foydalanuvchisini yaratadi."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant",
            type=str,
            help="Tenant nomi, schema_name (masalan: tenant_everest) yoki domeni",
        )
        parser.add_argument("--username",  type=str, help="Foydalanuvchi logini (username)")
        parser.add_argument("--email",     type=str, help="Email manzili")
        parser.add_argument("--password",  type=str, help="Parol")
        parser.add_argument("--full-name", type=str, default="", help="To'liq ismi")
        parser.add_argument("--phone",     type=str, default="", help="Telefon raqami")
        parser.add_argument("--no-input",  action="store_true", help="Interaktiv so'rovlarsiz ishlash")

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "\n╔════════════════════════════════════════════════════╗\n"
                "║   Tenant Ichida Yangi Super Admin Yaratish        ║\n"
                "╚════════════════════════════════════════════════════╝\n"
            )
        )

        no_input = options.get("no_input", False)
        tenant_identifier = options.get("tenant")

        # ── 1. Tenantni aniqlash ──────────────────────────────────────────────
        tenant = None
        if tenant_identifier:
            tenant = (
                Tenant.objects.filter(schema_name=tenant_identifier).first()
                or Tenant.objects.filter(name__iexact=tenant_identifier).first()
                or Tenant.objects.filter(domains__domain__iexact=tenant_identifier).first()
            )
            if not tenant:
                raise CommandError(f"'{tenant_identifier}' nomli yoki domenli tenant topilmadi!")

        if not tenant:
            if no_input:
                raise CommandError("--tenant parametri ko'rsatilishi shart!")

            tenants = list(Tenant.objects.all().order_by("id"))
            if not tenants:
                raise CommandError("Tizimda hali birorta ham tenant mavjud emas! Avval tenant yarating.")

            self.stdout.write(self.style.SUCCESS("Mavjud tenantlar ro'yxati:"))
            for idx, t in enumerate(tenants, 1):
                domain_str = ", ".join(t.domains.values_list("domain", flat=True)) or "domen yo'q"
                self.stdout.write(f"  [{idx}] {t.name} (Schema: {t.schema_name} | Domen: {domain_str})")

            while True:
                choice = input(f"\nKerakli tenant raqamini tanlang [1-{len(tenants)}]: ").strip()
                if choice.isdigit() and 1 <= int(choice) <= len(tenants):
                    tenant = tenants[int(choice) - 1]
                    break
                self.stdout.write(self.style.ERROR("Noto'g'ri raqam kiritildi. Qaytadan urinib ko'ring."))

        self.stdout.write(self.style.NOTICE(f"\nTanlangan tenant: {tenant.name} (Schema: {tenant.schema_name})"))

        # ── 2. Foydalanuvchi ma'lumotlarini olish ──────────────────────────────
        username = options.get("username") or self._ask("Username (login)", no_input)
        email = options.get("email") or self._ask("Email", no_input)
        full_name = options.get("full_name") or (input("To'liq ism (ixtiyoriy): ").strip() if not no_input else "")
        phone = options.get("phone") or (input("Telefon raqam (ixtiyoriy): ").strip() if not no_input else "")
        password = options.get("password") or self._ask_password(no_input)

        # ── 3. Tenant schemasiga ulanish va foydalanuvchini yaratish ──────────
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()

        try:
            # PostgreSQL search_path ni tegishli tenant schemasiga o'rnatamiz
            set_search_path(tenant.schema_name)

            if UserModel.objects.filter(username=username).exists():
                raise CommandError(f"'{username}' username ushbu tenant ({tenant.schema_name}) ichida allaqachon mavjud!")

            name_parts = full_name.strip().split(" ", 1) if full_name else ["Super", "Admin"]
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            user = UserModel.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role="super_admin",
                is_staff=True,
                is_superuser=True,
                phone_number=phone or None,
            )

            primary_domain = tenant.domains.first()
            login_url = f"https://{primary_domain.domain}/login" if primary_domain else "o'z subdomeningiz orqali"

            self.stdout.write("\n" + self.style.SUCCESS("✓ Super Admin muvaffaqiyatli yaratildi!"))
            self.stdout.write("─" * 50)
            self.stdout.write(f"  Tenant       : {tenant.name} ({tenant.schema_name})")
            self.stdout.write(f"  Username     : {user.username}")
            self.stdout.write(f"  Email        : {user.email}")
            self.stdout.write(f"  Rol          : {user.role}")
            self.stdout.write(f"  Kirish sahifasi: {login_url}")
            self.stdout.write("─" * 50 + "\n")

        finally:
            # Har qanday holatda search_path ni public ga qaytaramiz
            reset_search_path()

    def _ask(self, prompt: str, no_input: bool) -> str:
        if no_input:
            raise CommandError(f"--{prompt.lower()} parametri talab qilinadi (--no-input rejimida)")
        while True:
            val = input(f"{prompt}: ").strip()
            if val:
                return val
            self.stdout.write(self.style.ERROR(f"{prompt} bo'sh bo'lishi mumkin emas."))

    def _ask_password(self, no_input: bool) -> str:
        if no_input:
            raise CommandError("--password parametri talab qilinadi (--no-input rejimida)")
        while True:
            p1 = getpass.getpass("Parol: ")
            if not p1:
                self.stdout.write(self.style.ERROR("Parol bo'sh bo'lishi mumkin emas."))
                continue
            p2 = getpass.getpass("Parolni takrorlang: ")
            if p1 != p2:
                self.stdout.write(self.style.ERROR("Parollar mos kelmadi. Qaytadan urinib ko'ring."))
                continue
            return p1

"""
create_tenant — CLI orqali yangi o'quv markaz (tenant) yaratish.

Ishlatish:
    # Interaktiv rejim (barcha maydonlar so'raladi)
    python manage.py create_tenant

    # To'liq parametrlar bilan
    python manage.py create_tenant \\
        --name="Najot Ta'lim" \\
        --domain="najot.crm.uz" \\
        --plan=pro \\
        --admin-email="admin@najot.crm.uz" \\
        --admin-password="SecurePass123!" \\
        --admin-name="Abdulloh Rahimov" \\
        --trial-days=30 \\
        --city="Toshkent"
"""

import getpass
import logging

from django.core.management.base import BaseCommand, CommandError

from tenants.services import TenantProvisioningService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Yangi o'quv markaz (tenant) yaratadi va to'liq provisioning bajaradi."

    def add_arguments(self, parser):
        parser.add_argument("--name",           type=str, help="O'quv markaz nomi")
        parser.add_argument("--domain",         type=str, help="Tenant domeni (masalan: najot.crm.uz)")
        parser.add_argument("--plan",           type=str, default="starter",
                            choices=["starter", "pro", "enterprise"], help="Tarif rejasi")
        parser.add_argument("--admin-email",    type=str, help="Admin email manzili")
        parser.add_argument("--admin-password", type=str, help="Admin paroli (xavfsizroq: so'ratsiz qoldiring)")
        parser.add_argument("--admin-name",     type=str, default="", help="Admin to'liq ismi")
        parser.add_argument("--admin-phone",    type=str, default="", help="Admin telefon raqami")
        parser.add_argument("--trial-days",     type=int, default=30, help="Sinov davri (kun)")
        parser.add_argument("--city",           type=str, default="", help="Markaz shahri")
        parser.add_argument("--contact-phone",  type=str, default="", help="Markaz aloqa telefoni")
        parser.add_argument("--no-input",       action="store_true", help="Interaktiv so'rovlarsiz ishlash")

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "\n╔══════════════════════════════════════════╗\n"
                "║   Multi-Tenant SaaS — Yangi Markaz       ║\n"
                "╚══════════════════════════════════════════╝\n"
            )
        )

        no_input = options.get("no_input", False)

        # ── Parametrlarni to'ldirish (interaktiv yoki CLI) ───────────────────
        name           = options.get("name")           or self._ask("O'quv markaz nomi", no_input)
        domain         = options.get("domain")         or self._ask("Domen (masalan: najot.crm.uz)", no_input)
        plan           = options.get("plan", "starter")
        admin_email    = options.get("admin_email")    or self._ask("Admin email", no_input)
        admin_password = options.get("admin_password") or self._ask_password(no_input)
        admin_name     = options.get("admin_name", "")
        admin_phone    = options.get("admin_phone", "")
        trial_days     = options.get("trial_days", 30)
        city           = options.get("city", "")
        contact_phone  = options.get("contact_phone", "")

        # ── Yakuniy tasdiqlash ────────────────────────────────────────────────
        if not no_input:
            self.stdout.write("\n" + "─" * 50)
            self.stdout.write(f"  Markaz nomi  : {name}")
            self.stdout.write(f"  Domen        : {domain}")
            self.stdout.write(f"  Tarif        : {plan}")
            self.stdout.write(f"  Admin email  : {admin_email}")
            self.stdout.write(f"  Sinov davri  : {trial_days} kun")
            self.stdout.write("─" * 50 + "\n")

            confirm = input("Yuqoridagi ma'lumotlar to'g'rimi? [y/N]: ").strip().lower()
            if confirm not in ("y", "yes", "ha", "h"):
                self.stdout.write(self.style.WARNING("Bekor qilindi."))
                return

        # ── Provisioning ─────────────────────────────────────────────────────
        service = TenantProvisioningService()

        try:
            self.stdout.write("\n⏳ Provisioning boshlandi...")

            result = service.provision(
                name=name,
                domain=domain,
                plan=plan,
                admin_email=admin_email,
                admin_password=admin_password,
                admin_full_name=admin_name,
                admin_phone=admin_phone,
                trial_days=trial_days,
                city=city,
                contact_phone=contact_phone,
            )

            # ── Muvaffaqiyatli natija ─────────────────────────────────────────
            tenant  = result["tenant"]
            sub     = result["subscription"]
            admin   = result["admin_user"]

            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✅ MUVAFFAQIYATLI YARATILDI!\n"
                    f"{'─' * 50}\n"
                    f"  Tenant ID    : {tenant.id}\n"
                    f"  Markaz nomi  : {tenant.name}\n"
                    f"  Schema       : {tenant.schema_name}\n"
                    f"  Domen        : {domain}\n"
                    f"  Tarif        : {sub.get_plan_display()}\n"
                    f"  Obuna tugash : {sub.expires_at.strftime('%Y-%m-%d')}\n"
                    f"  Admin        : {admin.username} ({admin_email})\n"
                    f"{'─' * 50}\n"
                    f"  🔗 Kirish: https://{domain}\n"
                )
            )

        except ValueError as exc:
            raise CommandError(f"Validatsiya xatosi: {exc}") from exc
        except Exception as exc:
            logger.error("Provisioning muvaffaqiyatsiz: %s", exc, exc_info=True)
            raise CommandError(f"Provisioning muvaffaqiyatsiz: {exc}") from exc

    def _ask(self, prompt: str, no_input: bool) -> str:
        """Foydalanuvchidan qiymat so'rash."""
        if no_input:
            raise CommandError(
                f"--no-input rejimida '{prompt}' uchun parametr berilmagan."
            )
        value = input(f"  {prompt}: ").strip()
        if not value:
            raise CommandError(f"'{prompt}' bo'sh bo'lishi mumkin emas.")
        return value

    def _ask_password(self, no_input: bool) -> str:
        """Parolni maxfiy kiritish (ekranda ko'rinmaydi)."""
        if no_input:
            raise CommandError("--no-input rejimida --admin-password parametri talab qilinadi.")
        password = getpass.getpass("  Admin paroli: ").strip()
        if len(password) < 8:
            raise CommandError("Parol kamida 8 belgidan iborat bo'lishi kerak.")
        confirm = getpass.getpass("  Parolni tasdiqlang: ").strip()
        if password != confirm:
            raise CommandError("Parollar mos kelmadi.")
        return password

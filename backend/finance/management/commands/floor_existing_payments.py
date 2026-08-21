"""
Management command: floor_existing_payments

Maqsad:
  Ma'lumotlar bazasidagi mavjud to'lovlar summasini 1000 ga yaxlitlash
  (floor_amount logikasi bo'yicha: 350548 -> 350000).

Ishlatish:
  # Faqat to'lanmagan to'lovlar (xavfsiz)
  python manage.py floor_existing_payments

  # To'lanmagan + to'langan to'lovlar ham (ehtiyot bilan!)
  python manage.py floor_existing_payments --include-paid

  # Faqat ko'rish (hech narsa o'zgartirmasdan, dry-run)
  python manage.py floor_existing_payments --dry-run

  # Xodim to'lovlarini ham (EmployeePayment)
  python manage.py floor_existing_payments --include-employee
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from finance.models import Payment, EmployeePayment
from finance.utils import floor_amount
from decimal import Decimal


class Command(BaseCommand):
    help = "Mavjud to'lovlarni 1000 ga yaxlitlash (floor)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--include-paid',
            action='store_true',
            default=False,
            help="To'langan to'lovlarni ham o'zgartirish (xavfli, ehtiyot biling)"
        )
        parser.add_argument(
            '--include-employee',
            action='store_true',
            default=False,
            help="Xodim (EmployeePayment) to'lovlarini ham o'zgartirish"
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help="Hech narsa o'zgartirmasdan faqat natijani ko'rsatish"
        )

    def handle(self, *args, **options):
        include_paid = options['include_paid']
        include_employee = options['include_employee']
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING("🔍 DRY-RUN rejimi: hech narsa o'zgartirilamyapti\n"))

        # ──────────────────────────────────────────────────────────
        # 1. STUDENT PAYMENTS
        # ──────────────────────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING("\n📋 O'quvchi to'lovlari..."))

        qs_student = Payment.objects.exclude(amount__isnull=True)
        if not include_paid:
            qs_student = qs_student.filter(is_paid=False)
            self.stdout.write("  → Faqat to'lanmagan to'lovlar (--include-paid bilan to'langanlarni ham qo'shing)")
        else:
            self.stdout.write(self.style.WARNING("  ⚠️  To'langan to'lovlar ham kiritildi!"))

        student_total = qs_student.count()
        student_changed = 0
        student_skipped = 0

        with transaction.atomic():
            for payment in qs_student.iterator(chunk_size=500):
                old_amount = payment.amount
                new_amount = floor_amount(old_amount)

                if old_amount == new_amount:
                    student_skipped += 1
                    continue

                if not dry_run:
                    payment.amount = new_amount
                    # amount ni to'g'ridan-to'g'ri yangilaymiz, save() signallarni ishlatmaslik uchun
                    Payment.objects.filter(pk=payment.pk).update(amount=new_amount)

                student_changed += 1
                self.stdout.write(
                    f"  [{payment.id}] {payment.student.full_name} | "
                    f"{payment.group.name} | "
                    f"{old_amount:,.0f} → {new_amount:,.0f}"
                )

            if dry_run:
                self.stdout.write(self.style.WARNING("  (dry-run, o'zgartirilmadi)"))

        self.stdout.write(self.style.SUCCESS(
            f"\n  ✅ O'quvchi to'lovlari: {student_changed} ta o'zgartirildi, "
            f"{student_skipped} ta allaqachon to'g'ri edi"
            f" (jami tekshirildi: {student_total})"
        ))

        # ──────────────────────────────────────────────────────────
        # 2. EMPLOYEE PAYMENTS (ixtiyoriy)
        # ──────────────────────────────────────────────────────────
        if include_employee:
            self.stdout.write(self.style.MIGRATE_HEADING("\n💼 Xodim to'lovlari..."))

            qs_emp = EmployeePayment.objects.exclude(salary_base__isnull=True)
            if not include_paid:
                qs_emp = qs_emp.filter(is_paid=False)

            emp_total = qs_emp.count()
            emp_changed = 0
            emp_skipped = 0

            with transaction.atomic():
                for emp in qs_emp.iterator(chunk_size=500):
                    old_salary = emp.salary_base
                    new_salary = floor_amount(old_salary)

                    # Bonus va ayirmalar ham
                    old_bonus = emp.bonus or Decimal('0')
                    new_bonus = floor_amount(old_bonus)
                    old_deductions = emp.deductions or Decimal('0')
                    new_deductions = floor_amount(old_deductions)

                    if old_salary == new_salary and old_bonus == new_bonus and old_deductions == new_deductions:
                        emp_skipped += 1
                        continue

                    if not dry_run:
                        EmployeePayment.objects.filter(pk=emp.pk).update(
                            salary_base=new_salary,
                            bonus=new_bonus,
                            deductions=new_deductions
                        )

                    emp_changed += 1
                    name = emp.employee.get_full_name() or emp.employee.username
                    self.stdout.write(
                        f"  [{emp.id}] {name} | "
                        f"Maosh: {old_salary:,.0f} → {new_salary:,.0f} | "
                        f"Bonus: {old_bonus:,.0f} → {new_bonus:,.0f}"
                    )

            self.stdout.write(self.style.SUCCESS(
                f"\n  ✅ Xodim to'lovlari: {emp_changed} ta o'zgartirildi, "
                f"{emp_skipped} ta allaqachon to'g'ri edi"
                f" (jami tekshirildi: {emp_total})"
            ))

        # ──────────────────────────────────────────────────────────
        # XULOSA
        # ──────────────────────────────────────────────────────────
        self.stdout.write("\n" + "─" * 60)
        if dry_run:
            self.stdout.write(self.style.WARNING(
                "🔍 Dry-run tugadi. Haqiqatan o'zgartirish uchun --dry-run ni olib tashlang."
            ))
        else:
            self.stdout.write(self.style.SUCCESS("🎉 Barcha to'lovlar muvaffaqiyatli yaxlitlandi!"))

from django.core.management.base import BaseCommand
from tenants.utils import tenant_schema_context
from tenants.models import Tenant
from groups.models import Student, GroupEnrollment, GroupTransfer
from finance.models import Payment
from django.db import transaction


class Command(BaseCommand):
    help = (
        "Barcha tenantlarda boshqa guruhga ko'chirilgan (transfer) o'quvchilarning "
        "eski guruh enrollmentlarini butunlay uzadi va eski guruh bo'yicha keyingi oylarga "
        "yaratilgan soxta (unpaid ghost) to'lovlarni tozalaydi."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help="Hech narsani o'chirmasdan faqat ko'rsatish"
        )
        parser.add_argument(
            '--tenant',
            type=str,
            default=None,
            help="Faqat bitta tenant schemasi uchun ishlatish (masalan: tenant_everest)"
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        target_tenant = options['tenant']

        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY-RUN] Hech narsa o'chirilmaydi yoki o'zgartirilmaydi!\n"))

        tenants = Tenant.objects.exclude(schema_name='public')
        if target_tenant:
            tenants = tenants.filter(schema_name=target_tenant)

        total_transfers_processed = 0
        total_old_enrollments_deleted = 0
        total_ghost_payments_deleted = 0
        total_students_synced = 0

        for tenant in tenants:
            self.stdout.write(self.style.NOTICE(f"\n=========================================="))
            self.stdout.write(self.style.NOTICE(f"Tenant: {tenant.schema_name}"))
            self.stdout.write(self.style.NOTICE(f"=========================================="))

            with tenant_schema_context(tenant.schema_name):
                # ──────────────────────────────────────────────────────────
                # 1. GROUP TRANSFERS BO'YICHA ESKI GURUH ENROLLMENT VA TO'LOVLARNI TOZALASH
                # ──────────────────────────────────────────────────────────
                transfers = GroupTransfer.objects.select_related('student', 'from_group', 'to_group').all()
                self.stdout.write(f"Topilgan transferlar: {transfers.count()} ta")

                for trf in transfers:
                    st = trf.student
                    from_grp = trf.from_group
                    to_grp = trf.to_group
                    trf_date = trf.transfer_date
                    trf_month_start = trf_date.replace(day=1)

                    if not st or not from_grp or not to_grp:
                        continue

                    total_transfers_processed += 1

                    # A. Eski guruh enrollmentini uzish (butunlay o'chirish)
                    old_enrs = GroupEnrollment.objects.filter(student=st, group=from_grp)
                    old_count = old_enrs.count()
                    if old_count > 0:
                        self.stdout.write(
                            self.style.WARNING(
                                f"  [TRANSFER ENR] Student ID={st.id} ({st.full_name}): "
                                f"Eski guruh ({from_grp.name}) enrollmenti o'chirilmoqda ({old_count} ta)"
                            )
                        )
                        if not dry_run:
                            old_enrs.delete()
                        total_old_enrollments_deleted += old_count

                    # B. Studentning asosiy guruhi to'g'ri yangilanganligini tekshirish
                    if st.group_id == from_grp.id or not st.group_id:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  [SYNC STUDENT GROUP] Student ID={st.id} ({st.full_name}): "
                                f"group {st.group_id} -> {to_grp.id} ({to_grp.name})"
                            )
                        )
                        if not dry_run:
                            st.group = to_grp
                            st.branch = to_grp.branch
                            st.save(update_fields=['group', 'branch'])
                        total_students_synced += 1

                    # C. Transfer oyidan KEYINGI oylarda eski guruh uchun yaratilgan to'lanmagan to'lovlarni o'chirish
                    ghost_payments = Payment.objects.filter(
                        student=st,
                        group=from_grp,
                        month__gt=trf_month_start,
                        paid_amount=0
                    )
                    ghost_count = ghost_payments.count()
                    if ghost_count > 0:
                        for gp in ghost_payments:
                            self.stdout.write(
                                self.style.ERROR(
                                    f"  [GHOST PAYMENT] Student ID={st.id} ({st.full_name}): "
                                    f"Eski guruh ({from_grp.name}) uchun oy={gp.month} to'lanmagan to'lov "
                                    f"(amount={gp.amount}) o'chirilmoqda"
                                )
                            )
                        if not dry_run:
                            ghost_payments.delete()
                        total_ghost_payments_deleted += ghost_count

                # ──────────────────────────────────────────────────────────
                # 2. STUDENT.GROUP BO'YICHA BOSHQARUV (MULTI-ENROLLMENT VA ESKI ENROLLMENTLARNI UZISH)
                # ──────────────────────────────────────────────────────────
                # O'quvchining asosiy guruhi st.group bo'lsa, boshqa guruhlardagi nofaol yoki eski enrollmentlarni uzish
                active_students = Student.objects.filter(is_active=True, is_archived=False).exclude(group__isnull=True)
                for st in active_students:
                    redundant_enrs = GroupEnrollment.objects.filter(student=st).exclude(group=st.group)
                    r_count = redundant_enrs.count()
                    if r_count > 0:
                        for re in redundant_enrs:
                            # Faqat o'quvchi ushbu guruhda darsga kirmagan (Attendance yo'q) soxta to'lovlar o'chiriladi
                            from homework_attends.models import Attendance
                            candidate_payments = Payment.objects.filter(student=st, group=re.group, paid_amount=0)
                            safe_to_delete_ids = []
                            for cp in candidate_payments:
                                has_att = Attendance.objects.filter(
                                    student=st,
                                    group=re.group,
                                    date__year=cp.month.year,
                                    date__month=cp.month.month,
                                    is_present=True
                                ).exists()
                                if not has_att:
                                    safe_to_delete_ids.append(cp.id)

                            unpaid_cnt = len(safe_to_delete_ids)
                            self.stdout.write(
                                self.style.WARNING(
                                    f"  [REDUNDANT ENR] Student ID={st.id} ({st.full_name}): "
                                    f"Asosiy guruh '{st.group.name}', lekin '{re.group.name}' enrollmenti bor. "
                                    f"Enrollment o'chirilmoqda ({unpaid_cnt} ta dars qatnashilmagan to'lanmagan to'lov bilan)"
                                )
                            )
                            if not dry_run:
                                if safe_to_delete_ids:
                                    Payment.objects.filter(id__in=safe_to_delete_ids).delete()
                                re.delete()
                                total_ghost_payments_deleted += unpaid_cnt
                                total_old_enrollments_deleted += 1

                # ──────────────────────────────────────────────────────────
                # 3. NOFAOL (is_active=False) BO'LGAN ENROLLMENTLARNI BUTUNLAY UZISH
                # ──────────────────────────────────────────────────────────
                inactive_enrs = GroupEnrollment.objects.filter(is_active=False)
                inact_count = inactive_enrs.count()
                if inact_count > 0:
                    self.stdout.write(
                        self.style.WARNING(f"  [INACTIVE ENR] Jami {inact_count} ta nofaol enrollment butunlay o'chirilmoqda")
                    )
                    if not dry_run:
                        inactive_enrs.delete()
                    total_old_enrollments_deleted += inact_count

        self.stdout.write(self.style.SUCCESS(f"\n=========================================="))
        self.stdout.write(self.style.SUCCESS(f"YAKUNIY NATIJA:"))
        self.stdout.write(self.style.SUCCESS(f"  - Tekshirilgan transferlar: {total_transfers_processed}"))
        self.stdout.write(self.style.SUCCESS(f"  - Uzilgan (o'chirilgan) eski enrollmentlar: {total_old_enrollments_deleted}"))
        self.stdout.write(self.style.SUCCESS(f"  - O'chirilgan soxta (ghost) to'lovlar: {total_ghost_payments_deleted}"))
        self.stdout.write(self.style.SUCCESS(f"  - Yangilangan o'quvchi guruhlari: {total_students_synced}"))
        self.stdout.write(self.style.SUCCESS(f"==========================================\n"))

from decimal import Decimal

from branches.models import Branch
from branches.serializers import BranchSerializer
from django.contrib.auth import get_user_model
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from finance.models import Payment
from rest_framework import serializers

from .models import Group, MentorGroupAssignment, Student, WaitingStudent

User = get_user_model()


def _safe_attendance_metrics(group):
    """Attendance jadvali yoki query xato bersa ham serializer yiqilmasin."""
    try:
        from django.utils import timezone
        from homework_attends.models import Attendance

        today = timezone.localdate()
        qs = Attendance.objects.filter(group=group, date=today)
        return {
            "confirmed": qs.filter(marked_by__isnull=False).exists(),
            "present": qs.filter(is_present=True).count(),
            "absent": qs.filter(is_present=False).count(),
        }
    except Exception:
        return {"confirmed": False, "present": 0, "absent": 0}


# Oddiy mentorlar ro'yxati uchun serializer
class MentorListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    accessible_branches = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "full_name", "role", "branch_id", "accessible_branches")

    from drf_spectacular.utils import extend_schema_field

    @extend_schema_field(serializers.CharField())
    def get_full_name(self, obj) -> str:
        """To'liq ism-familiyani qaytaradi"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.username

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_accessible_branches(self, obj) -> list:
        """Mentorga ruxsat berilgan qo'shimcha filiallar ro'yxati"""
        try:
            accesses = obj.branch_accesses.all().select_related("branch")
            return [
                {"id": acc.branch.id, "branch_name": acc.branch.name}
                for acc in accesses
            ]
        except Exception:
            return []


class GroupSimpleSerializer(serializers.ModelSerializer):
    students_count = serializers.SerializerMethodField()
    branch = BranchSerializer(read_only=True)
    branch_id = serializers.IntegerField(source='branch.id', read_only=True)  # Frontend filter uchun
    today_attendance_confirmed = serializers.SerializerMethodField()
    present_count = serializers.SerializerMethodField()
    absent_count = serializers.SerializerMethodField()
    mentor = MentorListSerializer(read_only=True)
    computed_status = serializers.CharField(read_only=True)

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "group_type",
            "is_faol",
            "computed_status",
            "color",
            "subject",
            "mentor",
            "monthly_price",
            "days",
            "dars_kunlari",
            "dars_vaqti",
            "students_count",
            "branch",
            "branch_id",
            "today_attendance_confirmed",
            "present_count",
            "absent_count",
        )

    def get_today_attendance_confirmed(self, obj) -> bool:
        try:
            return _safe_attendance_metrics(obj)["confirmed"]
        except Exception:
            return False

    def get_present_count(self, obj) -> int:
        try:
            return _safe_attendance_metrics(obj)["present"]
        except Exception:
            return 0

    def get_absent_count(self, obj) -> int:
        try:
            return _safe_attendance_metrics(obj)["absent"]
        except Exception:
            return 0

    def get_students_count(self, obj) -> int:
        try:
            if hasattr(obj, '_students_count'):
                return obj._students_count
            # Faqat is_active=True bo'lgan o'quvchilarni sanaymiz
            return obj.enrollments.filter(is_active=True).count()
        except Exception:
            return 0


class MentorAssignmentSerializer(serializers.ModelSerializer):
    mentor_name = serializers.CharField(source="mentor.get_full_name", read_only=True)
    mentor_username = serializers.CharField(source="mentor.username", read_only=True)
    assigned_by_name = serializers.CharField(
        source="assigned_by.get_full_name", read_only=True, allow_null=True
    )

    class Meta:
        model = MentorGroupAssignment
        fields = [
            "id",
            "mentor",
            "mentor_name",
            "mentor_username",
            "assigned_at",
            "assigned_by",
            "assigned_by_name",
        ]
        read_only_fields = ["assigned_at", "assigned_by", "assigned_by_name"]


class RemoveMentorSerializer(serializers.Serializer):
    mentor_id = serializers.IntegerField(
        help_text="Olib tashlanadigan mentorning ID raqami"
    )


class AssignAdditionalMentorSerializer(serializers.Serializer):
    """Faqat bitta field — mentor tanlash uchun. Forma faqat shu chiqadi"""

    mentor = serializers.ChoiceField(
        choices=[], help_text="Mavjud mentorlardan birini tanlang"
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            # Faqat mentorlarni olamiz
            mentor_qs = User.objects.filter(role="mentor")
            if request.user.role == "admin":
                mentor_qs = mentor_qs.filter(branch=request.user.branch)

            # Har bir mentor uchun (id, display_name) juftligi
            choices = []
            for mentor in mentor_qs:
                display_name = mentor.get_full_name() or mentor.username
                choices.append((mentor.id, f"{display_name} (ID: {mentor.id})"))

            self.fields["mentor"].choices = choices


class StudentSerializer(serializers.ModelSerializer):
    group = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(), allow_null=True
    )
    # BUG FIX: groups = GroupSimpleSerializer(many=True, read_only=True) barcha
    # GroupEnrollment yozuvlarini (is_active=False larni ham) ko'rsatardi.
    # Endi faqat is_active=True bo'lgan guruhlar qaytariladi.
    groups = serializers.SerializerMethodField()
    # Yangi qo'shiladigan maydonlar
    current_payment_status = serializers.SerializerMethodField()
    current_payment_id = serializers.SerializerMethodField()
    create_payment = serializers.BooleanField(write_only=True, default=True)

    class Meta:
        model = Student
        fields = (
            "id",
            "full_name",
            "branch_id",
            "group",
            "groups",
            "phone",
            "birth_date",
            "parent_name",
            "parent_phone",
            "address",
            "notes",
            "color",
            "image",
            "joined_at",
            "current_payment_status",
            "current_payment_id",
            "telegram_id",
            "parent_telegram_id",
            "status",
            "custom_fee",
            "create_payment",
            "include_in_mentor_salary",
        )
        read_only_fields = ("joined_at",)

    def get_groups(self, obj) -> list:
        """Faqat is_active=True bo'lgan enrollmentlardagi guruhlarni qaytaradi.
        Bu o'quvchi ko'chirilgandan keyin eski guruhini ko'rsatib qolmasligini ta'minlaydi."""
        from .models import GroupEnrollment
        active_group_ids = GroupEnrollment.objects.filter(
            student=obj, is_active=True
        ).values_list('group_id', flat=True)
        active_groups = Group.objects.filter(id__in=active_group_ids)
        return GroupSimpleSerializer(active_groups, many=True, context=self.context).data

    def get_current_payment_status(self, obj) -> bool:
        """O'quvchining shu oydagi to'lov holati (True/False)"""
        # 1. Global balansni tekshirish
        try:
            finance_profile = getattr(obj, 'finance_profile', None)
            if finance_profile and finance_profile.balance >= 0:
                return True
        except Exception:
            pass

        today = timezone.now().date()
        first_day_of_month = today.replace(day=1)

        # Payment modelidan shu o'quvchi va shu oyga tegishlisini qidiramiz
        payment = Payment.objects.filter(student=obj, month=first_day_of_month).first()

        if payment and payment.amount == Decimal('0'):
            return True

        return payment.is_paid if payment else False

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_current_payment_id(self, obj) -> int:
        """Frontend uchun to'lovni tasdiqlashda kerak bo'ladigan Payment ID"""
        today = timezone.now().date()
        first_day_of_month = today.replace(day=1)

        payment = Payment.objects.filter(student=obj, month=first_day_of_month).first()

        return payment.id if payment else None

    def validate(self, attrs):
        """
        Status o'zgarganda custom_fee'ni nazorat qilish.
        Agar status 'regular' bo'lsa, custom_fee tozalanadi.
        Agar boshqa status bo'lib, summa kiritilmasa, u avtomatik 0 bo'ladi (eski qiymat qolib ketmasligi uchun).
        """
        status = attrs.get("status")
        # Agar status attrs ichida bo'lsa (ya'ni o'zgarayotgan bo'lsa)
        if status:
            if status in ["regular", "discount"]:
                attrs["custom_fee"] = None
                attrs["include_in_mentor_salary"] = False
            elif status in ["low_income", "negotiated"]:
                # Agar summa kiritilmagan bo'lsa (None yoki bo'sh), uni 0 qilamiz
                if "custom_fee" not in attrs or attrs.get("custom_fee") is None:
                    attrs["custom_fee"] = 0
                attrs["include_in_mentor_salary"] = False
            elif status == "teacher_negotiated":
                attrs["include_in_mentor_salary"] = False
            else:
                attrs["include_in_mentor_salary"] = False
        return attrs

    def update(self, instance, validated_data):
        from django.db import transaction
        from finance.models import Payment
        from finance.utils import floor_amount

        old_group = instance.group
        new_group = validated_data.get("group", old_group)

        with transaction.atomic():
            instance = super().update(instance, validated_data)

            # Agar guruh yoki custom_fee o'zgargan bo'lsa, joriy oy to'lovini yangilash
            # Eslatma: transfer-group action'i services.py orqali ishlaydi,
            # bu yerda esa Profile edit dagi o'zgarishlarni ushlaymiz.
            if new_group:
                today = timezone.now().date()
                month_start = today.replace(day=1)

                # Joriy oy uchun to'lovni qidiramiz
                payment = Payment.objects.filter(
                    student=instance, group=new_group, month=month_start
                ).first()

                if payment and not payment.is_paid:
                    # Statusga mos to'lovni yangilash
                    if instance.status == "discount":
                        from finance.utils import (
                            calculate_attendance_based_student_payment,
                        )

                        payment.amount = calculate_attendance_based_student_payment(
                            instance, new_group, month_start
                        )
                    else:
                        # User talabi: Advanced guruhda negotiated statusi o'tmaydi
                        if (
                            new_group.group_type == "advanced"
                            and instance.status == "negotiated"
                        ):
                            base_price = new_group.monthly_price
                        elif instance.status in [
                            "low_income",
                            "negotiated",
                            "teacher_negotiated",
                        ]:
                            base_price = (
                                instance.custom_fee
                                if instance.custom_fee is not None
                                else Decimal("0")
                            )
                        else:
                            base_price = new_group.monthly_price

                        payment.amount = floor_amount(base_price)

                    payment.save()

        return instance

    def create(self, validated_data):
        from django.db import transaction
        from django.utils import timezone
        from finance.models import Payment

        from .models import GroupEnrollment

        request = self.context.get("request")
        group = validated_data.get("group")
        create_payment = validated_data.pop("create_payment", True)

        # 1. Branch aniqlash
        branch_id = validated_data.pop("branch_id", None)
        branch = None

        if branch_id:
            from branches.models import Branch

            branch = Branch.objects.filter(id=branch_id).first()

        if not branch:
            if group:
                branch = group.branch
            elif request and hasattr(request.user, "branch"):
                branch = request.user.branch

        # Branch baribir topilmadi?
        if not branch and request and request.user.role == "mentor":
            branch = request.user.branch

        with transaction.atomic():
            # 1. Studentni yaratish
            student = Student.objects.create(branch=branch, **validated_data)

            # 2. Agar guruh tanlangan bo'lsa, M2M bog'liqlikni yaratish
            if group:
                from finance.utils import floor_amount

                from .models import GroupEnrollment

                GroupEnrollment.objects.get_or_create(student=student, group=group)

                # 3. Oylik to'lov varaqasini yaratish (har doim to'liq kurs narxi)
                if create_payment:
                    today = timezone.now().date()
                    month_start = today.replace(day=1)
                    if student.status == "discount":
                        from finance.utils import (
                            calculate_attendance_based_student_payment,
                        )

                        final_amount = calculate_attendance_based_student_payment(
                            student, group, month_start
                        )
                    else:
                        # User talabi: Advanced guruhda negotiated statusi o'tmaydi
                        if (
                            group.group_type == "advanced"
                            and student.status == "negotiated"
                        ):
                            base_price = group.monthly_price
                        elif student.status in [
                            "low_income",
                            "negotiated",
                            "teacher_negotiated",
                        ]:
                            base_price = (
                                student.custom_fee
                                if student.custom_fee is not None
                                else Decimal("0")
                            )
                        else:
                            base_price = group.monthly_price

                        final_amount = floor_amount(base_price)

                    Payment.objects.get_or_create(
                        student=student,
                        group=group,
                        month=month_start,
                        defaults={"amount": final_amount, "is_paid": False},
                    )

            return student


# serializers.py


class GroupShortSerializer(serializers.ModelSerializer):
    # Bu serializer guruhning faqat kerakli qismlarini qaytaradi
    branch_name = serializers.ReadOnlyField(source="branch.name")
    today_attendance_confirmed = serializers.SerializerMethodField()

    class Meta:
        model = Group  # Sizning guruh modelingiz nomi
        fields = (
            "id",
            "name",
            "group_type",
            "subject",
            "days",
            "dars_kunlari",
            "dars_vaqti",
            "students_count",
            "branch_name",
            "branch_id",  # Frontendda filterlash uchun kerak
            "today_attendance_confirmed",
        )

    def get_today_attendance_confirmed(self, obj) -> bool:
        return _safe_attendance_metrics(obj)["confirmed"]


class MentorNestedSerializer(serializers.ModelSerializer):
    # Branch ob'ektini to'liq ko'rinishi
    branch = BranchSerializer(read_only=True)

    # Branch ID sini boshqarish
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), source="branch", required=True, allow_null=True
    )

    # Yangi maydonlar
    accessible_branches = serializers.SerializerMethodField()
    mentor_groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "subject",
            "phone_number",
            "is_active",
            "role",
            "branch",
            "branch_id",
            "accessible_branches",
            "mentor_groups",
        )

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_accessible_branches(self, obj) -> list:
        """Mentorga ruxsat berilgan qo'shimcha filiallar ro'yxati"""
        try:
            # related_name='branch_accesses' ekanligiga ishonch hosil qiling
            accesses = obj.branch_accesses.all().select_related("branch")
            return [
                {"id": acc.branch.id, "branch_name": acc.branch.name}
                for acc in accesses
            ]
        except Exception:
            return []

    @extend_schema_field(GroupSimpleSerializer(many=True))
    def get_mentor_groups(self, obj) -> list:
        """Guruhlarni birlashtirish va branch_id bo'yicha filterlash"""
        request = self.context.get("request")
        # URL orqali kelgan branch_id (?branch_id=1)
        active_branch_id = request.query_params.get("branch_id") if request else None

        # 1. Mentor asosiy mentor bo'lgan guruhlar
        main_groups = obj.mentor_groups.all()

        # 2. Mentor yordamchi/qo'shimcha mentor bo'lgan guruhlar
        # (Model nomingizga qarab filterlang, masalan: additional_mentors__mentor=obj)
        additional_groups = Group.objects.filter(additional_mentors__mentor=obj)

        # 3. Ikkala turdagi guruhlarni birlashtiramiz
        all_groups = (main_groups | additional_groups).distinct()

        # 4. Filterlash logikasi
        if active_branch_id:
            try:
                all_groups = all_groups.filter(branch_id=int(active_branch_id))
            except ValueError:
                pass
        else:
            # Agar branch_id URL da berilmasa, mentorga ochiq barcha filiallardagi guruhlarini ko'rsatamiz
            pass

        # 5. Natijani qaytarish (Sizda bor bo'lgan GroupSimpleSerializer orqali)
        return GroupSimpleSerializer(all_groups, many=True, context=self.context).data


class AdminNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name")


class GroupNestedSerializer(serializers.ModelSerializer):
    mentor = MentorNestedSerializer(read_only=True)
    admin = AdminNestedSerializer(read_only=True)

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "group_type",
            "subject",
            "monthly_price",
            "days",
            "mentor",
            "admin",
            "is_faol",
        )


class StudentNestedSerializer(serializers.ModelSerializer):
    group = GroupNestedSerializer(read_only=True)
    # BUG FIX: groups = GroupNestedSerializer(many=True, read_only=True) barcha
    # GroupEnrollment yozuvlarini (is_active=False larni ham) ko'rsatardi.
    # Endi faqat is_active=True bo'lgan guruhlar qaytariladi.
    groups = serializers.SerializerMethodField()
    branch_id = serializers.IntegerField(source="group.branch.id", read_only=True)
    finance_profile = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = (
            "id",
            "group",
            "groups",
            "full_name",
            "branch_id",
            "phone",
            "birth_date",
            "parent_name",
            "parent_phone",
            "address",
            "image",
            "color",
            "notes",
            "telegram_id",
            "parent_telegram_id",
            "status",
            "custom_fee",
            "joined_at",
            "include_in_mentor_salary",
            "finance_profile",
        )
        read_only_fields = ("joined_at",)

    def get_groups(self, obj) -> list:
        """Faqat is_active=True bo'lgan enrollmentlardagi guruhlarni qaytaradi.
        Bu o'quvchi ko'chirilgandan keyin eski guruhini ko'rsatib qolmasligini ta'minlaydi."""
        from .models import GroupEnrollment
        active_group_ids = GroupEnrollment.objects.filter(
            student=obj, is_active=True
        ).values_list('group_id', flat=True)
        active_groups = Group.objects.filter(id__in=active_group_ids)
        return GroupNestedSerializer(active_groups, many=True, context=self.context).data

    @extend_schema_field(serializers.DictField())
    def get_finance_profile(self, obj) -> dict:
        try:
            profile = obj.finance_profile
            return {
                "total_paid_all_time": profile.total_paid_all_time,
                "total_refunded": profile.total_refunded,
                "last_payment_date": profile.last_payment_date,
                "balance": profile.balance
            }
        except Exception:
            return {
                "total_paid_all_time": 0,
                "total_refunded": 0,
                "last_payment_date": None,
                "balance": 0
            }


from django.db.models import Q


class GroupSerializer(serializers.ModelSerializer):
    mentor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role="mentor"),
        source="mentor",
        required=False,
        allow_null=True,
    )
    additional_mentors = MentorAssignmentSerializer(many=True, read_only=True)
    mentor = MentorNestedSerializer(read_only=True)
    admin = AdminNestedSerializer(read_only=True)
    students_count = serializers.SerializerMethodField()
    students = serializers.SerializerMethodField()
    branch = BranchSerializer(read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        source="branch",
        required=True,
        allow_null=True,
        write_only=True,
    )
    today_attendance_confirmed = serializers.SerializerMethodField()
    computed_status = serializers.CharField(read_only=True)
    special_lesson_dates = serializers.SerializerMethodField()
    canceled_lesson_dates = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "group_type",
            "monthly_price",
            "branch",
            "branch_id",
            "days",
            "dars_kunlari",
            "dars_vaqti",
            "subject",
            "mentor",
            "mentor_id",
            "color",
            "admin",
            "start_date",
            "computed_status",
            "description",
            "created_at",
            "students_count",
            "students",
            "additional_mentors",
            "today_attendance_confirmed",
            "special_lesson_dates",
            "canceled_lesson_dates",
        )
        read_only_fields = ("created_at", "students_count")

    def get_students_count(self, obj) -> int:
        # Faqat is_active=True bo'lgan o'quvchilarni sanaymiz
        return obj.enrollments.filter(is_active=True).count()

    @extend_schema_field(serializers.ListField(child=serializers.DateField()))
    def get_special_lesson_dates(self, obj):
        return list(obj.special_lesson_days.values_list("date", flat=True))

    @extend_schema_field(serializers.ListField(child=serializers.DateField()))
    def get_canceled_lesson_dates(self, obj):
        return list(obj.canceled_lesson_days.values_list("date", flat=True))

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_students(self, obj) -> list:
        """
        N+1 muammosini bartaraf etish: barcha to'lov ma'lumotlarini bitta so'rovda olamiz.
        Faqat guruhda faol (is_active=True) va arxivlanmagan o'quvchilar ro'yxatini qaytaramiz.
        """
        request = self.context.get("request")
        if request and request.query_params.get("exclude_students") == "true":
            return []

        from django.db.models import Q
        from django.utils import timezone
        from finance.models import Payment

        # Faqat ushbu guruhda active bo'lgan va arxivlanmagan o'quvchilarni tanlab olamiz
        active_student_ids = list(
            obj.enrollments.filter(is_active=True).values_list("student_id", flat=True)
        )
        students_qs = Student.objects.filter(
            id__in=active_student_ids, is_archived=False, is_active=True
        ).select_related("group", "branch", "finance_profile")

        today = timezone.now().date()
        month_start = today.replace(day=1)

        # Barcha studentlar uchun ushbu oydagi to'lovlarni BITTA so'rovda olamiz
        payments = Payment.objects.filter(
            student_id__in=active_student_ids, month=month_start, group=obj
        ).values("student_id", "id", "is_paid")

        # To'lovlarni dict ga aylantiramiz: {student_id: {id, is_paid}}
        payment_map = {p["student_id"]: p for p in payments}

        result = []
        for student in students_qs:
            payment_info = payment_map.get(student.id)
            # Enrollment sanasini olish
            enrollment = student.enrollments.filter(group=obj).first()
            joined_at = enrollment.joined_at if enrollment else student.joined_at

            # Iso formatda chiroyli ko'rinishga keltirish (Frontend split('T')[0] uchun)
            joined_at_str = joined_at.isoformat() if joined_at else None

            # Balansni tekshiramiz
            is_paid_status = False
            try:
                finance_profile = getattr(student, 'finance_profile', None)
                if finance_profile and finance_profile.balance >= 0:
                    is_paid_status = True
                elif payment_info:
                    if payment_info["amount"] == Decimal('0'):
                        is_paid_status = True
                    else:
                        is_paid_status = payment_info["is_paid"]
            except Exception:
                if payment_info:
                    is_paid_status = payment_info["amount"] == Decimal('0') or payment_info["is_paid"]

            result.append(
                {
                    "id": student.id,
                    "full_name": student.full_name,
                    "phone": student.phone,
                    "parent_phone": student.parent_phone,
                    "image": student.image.url if student.image else None,
                    "color": student.color,
                    "status": student.status,
                    "custom_fee": student.custom_fee,
                    "telegram_id": student.telegram_id,
                    "parent_telegram_id": student.parent_telegram_id,
                    "current_payment_status": is_paid_status,
                    "current_payment_id": payment_info["id"] if payment_info else None,
                    "joined_at": joined_at_str,
                }
            )
        return result

    def get_today_attendance_confirmed(self, obj) -> bool:
        return _safe_attendance_metrics(obj)["confirmed"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if not (request and request.user.is_authenticated):
            return

        user = request.user
        from authenticatsiya.models import BranchAccess

        # MUVOZANATNI SAQLASH: Admin uchun mentorlar ro'yxatini kengaytiramiz
        if user.role == "admin":
            # Admin boshqara oladigan branchlar
            allowed_b_ids = [user.branch_id] + list(
                BranchAccess.objects.filter(user=user).values_list(
                    "branch_id", flat=True
                )
            )

            # Mentor 11-ID ni topa olishi uchun querysetni shunday quramiz:
            # Mentor yo shu branchlarning birida asosiysi bo'lishi kerak,
            # yoki shu branchlarning biriga access'i bo'lishi kerak.
            from django.db.models import Q

            self.fields["mentor_id"].queryset = User.objects.filter(
                Q(role="mentor")
                & (
                    Q(branch_id__in=allowed_b_ids)
                    | Q(branch_accesses__branch_id__in=allowed_b_ids)
                )
            ).distinct()

        elif user.role == "super_admin":
            self.fields["mentor_id"].queryset = User.objects.filter(role="mentor")

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user
        from authenticatsiya.models import BranchAccess

        # Mentor va Branch ob'ektlarini aniqlaymiz (PUT/POST uchun)
        mentor = attrs.get("mentor") or (
            self.instance.mentor if self.instance else None
        )
        requested_branch = attrs.get("branch") or (
            self.instance.branch if self.instance else None
        )

        if user.role == "admin":
            # Admin boshqara oladigan branchlar
            admin_allowed_ids = [user.branch_id] + list(
                BranchAccess.objects.filter(user=user).values_list(
                    "branch_id", flat=True
                )
            )

            # a) Branch tekshiruvi (O'zgarishsiz)
            if requested_branch and requested_branch.id not in admin_allowed_ids:
                raise serializers.ValidationError(
                    {"branch_id": "Siz bu filialda guruh boshqara olmaysiz."}
                )

            # b) Mentor tekshiruvi (YANGI MANTIQ - Muvozanat uchun)
            if mentor and requested_branch:
                # Mentor shu tanlangan branchga tegishlimi (Asosiy yoki Access)?
                mentor_can_work = (
                    mentor.branch_id == requested_branch.id
                ) or BranchAccess.objects.filter(
                    user=mentor, branch=requested_branch
                ).exists()

                if not mentor_can_work:
                    raise serializers.ValidationError(
                        {
                            "mentor_id": f"Mentor {mentor.first_name} ushbu filialga ({requested_branch.name}) biriktirilmagan."
                        }
                    )
        return attrs


class MentorSerializer(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        required=True,
        allow_null=True,
        source="branch",  # Model dagi branch maydoniga bog'laymiz
    )
    # Yangi maydon
    accessible_branches = serializers.SerializerMethodField()
    # Guruhlar metod orqali olinadi
    mentor_groups = serializers.SerializerMethodField()
    groups_count = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "color",
            "image",
            "last_name",
            "subject",
            "phone_number",
            "is_active",
            "role",
            "branch",
            "branch_id",
            "accessible_branches",
            "mentor_groups",
            "groups_count",
            "students_count",
        )

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_accessible_branches(self, obj) -> list:
        """Faqat qo'shimcha ruxsat berilgan branchlarni qaytaradi"""
        # related_name='branch_accesses' ekanligiga ishonch hosil qiling
        accesses = obj.branch_accesses.all().select_related("branch")
        return [
            {"id": acc.branch.id, "branch_name": acc.branch.name} for acc in accesses
        ]

    @extend_schema_field(GroupSimpleSerializer(many=True))
    def get_mentor_groups(self, obj) -> list:
        """Guruhlarni birlashtiradi va branch_id bo'yicha filterlaydi"""

        # 1. URL dan branch_id ni olamiz (?branch_id=...)
        request = self.context.get("request")
        active_branch_id = request.query_params.get("branch_id") if request else None

        # 2. Asosiy guruhlar (Group.mentor = user)
        main_groups = obj.mentor_groups.all()

        # 3. Qo‘shimcha guruhlar (MentorGroupAssignment orqali)
        additional_groups = Group.objects.filter(additional_mentors__mentor=obj)

        # 4. Birlashtiramiz
        all_groups = (main_groups | additional_groups).distinct()

        # 5. FILTERLASH LOGIKASI
        if active_branch_id:
            # Agar frontenddan branch_id kelgan bo'lsa, o'shani filterlaymiz
            all_groups = all_groups.filter(branch_id=active_branch_id)
        else:
            # Agar branch_id kelmasa, mentor ruxsatidagi barcha guruhlar ko'rinadi
            pass

        return GroupSimpleSerializer(all_groups, many=True, context=self.context).data

    def _get_filtered_groups(self, obj):
        request = self.context.get("request")
        active_branch_id = request.query_params.get("branch_id") if request else None

        main_groups = obj.mentor_groups.all()
        additional_groups = Group.objects.filter(additional_mentors__mentor=obj)
        all_groups = (main_groups | additional_groups).distinct()

        if active_branch_id:
            try:
                all_groups = all_groups.filter(branch_id=int(active_branch_id))
            except (ValueError, TypeError):
                all_groups = all_groups.none()
        else:
            all_groups = all_groups.filter(branch_id=obj.branch_id)

        return all_groups

    def get_groups_count(self, obj) -> int:
        return self._get_filtered_groups(obj).count()

    def get_students_count(self, obj) -> int:
        groups_qs = self._get_filtered_groups(obj)
        return (
            Student.objects.filter(
                enrollments__group__in=groups_qs, enrollments__is_active=True
            )
            .distinct()
            .count()
        )


class AdminUserSerializers(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)
    # Parolni faqat yozish uchun qo'shamiz
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "color",
            "image",
            "password",
            "first_name",
            "last_name",
            "phone_number",
            "role",
            "branch",
        )

    def create(self, validated_data):
        # Parolni ajratib olamiz
        password = validated_data.pop("password", None)
        # Foydalanuvchini yaratamiz
        user = super().create(validated_data)
        if password:
            user.set_password(password)  # Shifrlab saqlash
            user.save()
        return user

    def update(self, instance, validated_data):
        # Parolni ajratib olamiz
        password = validated_data.pop("password", None)
        # Boshqa maydonlarni yangilaymiz
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)  # Yangi parolni shifrlab saqlash
            user.save()
        return user


from .models import GroupTransfer


class GroupTransferSerializer(serializers.ModelSerializer):
    from_group_name = serializers.CharField(source="from_group.name", read_only=True)
    to_group_name = serializers.CharField(source="to_group.name", read_only=True)
    marked_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupTransfer
        fields = (
            "id",
            "from_group",
            "from_group_name",
            "to_group",
            "to_group_name",
            "transfer_date",
            "old_group_fee",
            "new_group_fee",
            "reason",
            "marked_by",
            "marked_by_name",
            "created_at",
        )

    def get_marked_by_name(self, obj) -> str:
        if obj.marked_by:
            return obj.marked_by.get_full_name() or obj.marked_by.username
        return "Tizim"


class WaitingStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaitingStudent
        fields = "__all__"
        read_only_fields = ("created_at",)


class StudentGroupListSerializer(serializers.ModelSerializer):
    current_payment_status = serializers.SerializerMethodField()
    current_payment_id = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = (
            "id",
            "full_name",
            "phone",
            "image",
            "color",
            "status",
            "telegram_id",
            "parent_telegram_id",
            "current_payment_status",
            "current_payment_id",
            "joined_at",
        )

    def get_current_payment_status(self, obj):
        payment_map = self.context.get("payment_map", {})
        payment_info = payment_map.get(obj.id)
        return payment_info["is_paid"] if payment_info else False

    def get_current_payment_id(self, obj):
        payment_map = self.context.get("payment_map", {})
        payment_info = payment_map.get(obj.id)
        return payment_info["id"] if payment_info else None

    @extend_schema_field(serializers.DateTimeField(allow_null=True))
    def get_joined_at(self, obj) -> str:
        enrollment_map = self.context.get("enrollment_map", {})
        return enrollment_map.get(obj.id)

import logging
from django.db import transaction, models
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied

from .models import (
    Group, Student, MentorGroupAssignment, 
    GroupEnrollment, GroupTransfer, WaitingStudent
)
from .serializers import (
    GroupSerializer, GroupSimpleSerializer, StudentSerializer, 
    StudentNestedSerializer, AssignAdditionalMentorSerializer,
    RemoveMentorSerializer, MentorAssignmentSerializer,
    MentorListSerializer, WaitingStudentSerializer, MentorSerializer,
    AdminUserSerializers, StudentGroupListSerializer
)
from .permissions import (
    IsAdminOnly, IsGroupOwnerOrSuperAdmin,
    IsStudentGroupOwnerOrSuperAdmin, IsAdminOrSuperAdmin, 
    IsMentorBranchAccessible
)
from .services import (
    enroll_student_to_group, unenroll_student_from_group,
    transfer_student_to_group, merge_student_profiles,
    assign_waiting_student_to_group,
    cancel_lesson_day, reactivate_lesson_day
)

logger = logging.getLogger(__name__)

# --- Pagination ---

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

# --- ViewSets ---

class GroupViewSet(viewsets.ModelViewSet):
    """Guruhlarni boshqarish ViewSet"""
    queryset = Group.objects.select_related('mentor', 'admin', 'branch').prefetch_related('students', 'additional_mentors')
    serializer_class = GroupSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsGroupOwnerOrSuperAdmin]
    module_name = 'groups'

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['days', 'group_type', 'is_faol', 'branch']
    search_fields = [
        'name', 
        'subject',
        'mentor__first_name', 
        'mentor__last_name',  
    ]

    def get_serializer_class(self):
        if self.action == 'list':
            return GroupSimpleSerializer
        return GroupSerializer

    def get_queryset(self):
        try:
            user = self.request.user
            qs = super().get_queryset().filter(is_archived=False).select_related(
                'mentor', 'admin', 'branch'
            ).prefetch_related(
                'enrollments', 
                'additional_mentors__mentor',
                'mentor__branch_accesses__branch'
            )
            branch_id = self.request.query_params.get('branch_id')
            search = self.request.query_params.get('search', '').strip()

            if search:
                # To'g'ridan-to'g'ri qidiruv, faqat mos keladigan guruhlarni qaytarish
                qs = qs.filter(
                    Q(name__icontains=search) | 
                    Q(subject__icontains=search) | 
                    Q(mentor__first_name__icontains=search) | 
                    Q(mentor__last_name__icontains=search) | 
                    Q(mentor__username__icontains=search) |
                    Q(additional_mentors__mentor__first_name__icontains=search) |
                    Q(additional_mentors__mentor__last_name__icontains=search) |
                    Q(additional_mentors__mentor__username__icontains=search)
                ).distinct()

            if user.role == 'super_admin':
                return qs.filter(branch_id=branch_id) if branch_id else qs

            if user.role == 'admin':
                allowed = [user.branch.id] if user.branch else []
                if hasattr(user, 'branch_accesses'):
                    allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
                qs = qs.filter(branch_id__in=allowed)
                return qs.filter(branch_id=branch_id) if branch_id else qs

            if user.role == 'mentor':
                return qs.filter(Q(mentor=user) | Q(additional_mentors__mentor=user)).distinct()

            return Group.objects.none()
        except Exception:
            logger.exception("Group queryset error")
            return Group.objects.none()

    def list(self, request, *args, **kwargs):
        """
        Har bir guruhni alohida serialize qilamiz, bitta guruh xato bersa ham qolganlari chiqadi.
        Bugungi davomatni va o'quvchilar sonini bir queryda olamiz.
        """
        try:
            from django.utils import timezone
            from django.db.models import Count
            from homework_attends.models import Attendance
            
            queryset = self.filter_queryset(self.get_queryset())
            logger.info(f"Found {queryset.count()} groups for user {request.user.id}, branch_id: {request.query_params.get('branch_id')}")

            # Bugungi davomatni bir queryda olish
            today = timezone.localdate()
            group_ids = [g.id for g in queryset]
            attendances = Attendance.objects.filter(
                group_id__in=group_ids,
                date=today
            ).values('group_id', 'marked_by', 'is_present')
            
            # O'quvchilar sonini bir queryda olish
            enrollments = GroupEnrollment.objects.filter(
                group_id__in=group_ids,
                is_active=True
            ).values('group_id').annotate(count=Count('id'))
            
            # Davomatni dict ga saqlash
            attendance_map = {}
            for att in attendances:
                group_id = att['group_id']
                if group_id not in attendance_map:
                    attendance_map[group_id] = {
                        'confirmed': att['marked_by'] is not None,
                        'present': 0,
                        'absent': 0
                    }
                if att['is_present']:
                    attendance_map[group_id]['present'] += 1
                else:
                    attendance_map[group_id]['absent'] += 1
            
            # O'quvchilar sonini dict ga saqlash
            students_count_map = {e['group_id']: e['count'] for e in enrollments}

            page = self.paginate_queryset(queryset)
            if page is not None:
                # Har bir guruhni alohida serialize qilamiz, xatolarni loglaymiz
                serialized_data = []
                for item in page:
                    try:
                        # Guruh uchun davomatni va o'quvchilar sonini qo'shish
                        item_attendance = attendance_map.get(item.id, {
                            'confirmed': False,
                            'present': 0,
                            'absent': 0
                        })
                        item._attendance_metrics = item_attendance
                        item._students_count = students_count_map.get(item.id, 0)
                        
                        serializer = self.get_serializer(item)
                        serialized_data.append(serializer.data)
                        logger.info(f"Successfully serialized group {item.id} - {item.name}")
                    except Exception as e:
                        logger.exception(f"Group {item.id} serialization error: {e}")
                        continue
                return self.get_paginated_response(serialized_data)

            # Agar pagination bo'lmasa
            serialized_data = []
            for item in queryset:
                try:
                    # Guruh uchun davomatni va o'quvchilar sonini qo'shish
                    item_attendance = attendance_map.get(item.id, {
                        'confirmed': False,
                        'present': 0,
                        'absent': 0
                    })
                    item._attendance_metrics = item_attendance
                    item._students_count = students_count_map.get(item.id, 0)
                    
                    serializer = self.get_serializer(item)
                    serialized_data.append(serializer.data)
                except Exception as e:
                    logger.exception(f"Group {item.id} serialization error: {e}")
                    continue
            return Response(serialized_data)
        except Exception as e:
            page = request.query_params.get('page', 'unknown')
            branch_id = request.query_params.get('branch_id', 'unknown')
            search = request.query_params.get('search', '')
            logger.exception(
                "Group list error (page=%s, branch_id=%s, search=%s): %s",
                page, branch_id, search, str(e)
            )
            page = self.paginate_queryset(Group.objects.none())
            if page is not None:
                return self.get_paginated_response([])
            return Response([])

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get('branch') or (user.branch if user.role == 'admin' else None)
        if user.role in ['admin', 'super_admin']:
            serializer.save(admin=user, branch=branch)
        else:
            serializer.save(mentor=user, branch=user.branch)

    def retrieve(self, request, *args, **kwargs):
        """N+1 muammosini oldini olish bilan retrieve"""
        # queryset ni tozalaymiz (base dagi 'students' va 'additional_mentors' ni)
        queryset = self.get_queryset().prefetch_related(None)
        
        queryset = queryset.select_related(
            'mentor', 'mentor__branch', 'admin', 'branch'
        ).prefetch_related('additional_mentors__mentor')
        
        exclude_students = request.query_params.get('exclude_students', 'false').lower() == 'true'
        if not exclude_students:
            # Faqat guruhda active, arxivlanmagan va faol o'quvchilarni prefetch qilamiz
            # Avval active enrollment'lardagi student ID larini olamiz (N+1 oldini olish uchun
            # Shuni to'g'ri qilish uchun guruhni avval oldinda prefetchingni enrollmentsdan, lekin serializerda allaqachon studentsni o'zimiz
            # Shu bilan birga, serializerda get_students allaqachon o'zini oladi, shuning uchun shunchaki kerak emas, lekin yaxshilaymiz
            # Avval guruhni olamiz, keyin studentsni serializerda get_students orqali olamiz
            queryset = queryset.prefetch_related(
                Prefetch(
                    'enrollments',
                    queryset=GroupEnrollment.objects.filter(is_active=True).select_related('student__group', 'student__branch')
                )
            )
        else:
            # exclude_students bo'lsa 'students' umuman kerakmas
            pass

        instance = get_object_or_404(queryset, pk=kwargs['pk'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='enroll-student')
    def enroll_student(self, request, pk=None):
        group = self.get_object()
        student_id = request.data.get('student_id')
        create_payment = request.data.get('create_payment', True)
        
        try:
            enrollment, created = enroll_student_to_group(group, student_id, create_payment)
            if created:
                return Response({"status": "O'quvchi guruhga biriktirildi"}, status=201)
            return Response({"detail": "Ushbu o'quvchi allaqachon guruhda"}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='unenroll-student')
    def unenroll_student(self, request, pk=None):
        group = self.get_object()
        student_id = request.data.get('student_id')
        
        try:
            status_result = unenroll_student_from_group(group, student_id, request.user)
            msg = "O'quvchi guruhdan chiqarildi"
            if status_result == "waiting_hall":
                msg += " va kutish zaliga o'tkazildi"
            return Response({"status": msg}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='bulk-unenroll')
    def bulk_unenroll(self, request, pk=None):
        group = self.get_object()
        student_ids = request.data.get('student_ids', [])
        
        if not isinstance(student_ids, list):
            return Response({"error": "student_ids list bo'lishi kerak"}, status=400)
            
        results = []
        errors = []
        
        for sid in student_ids:
            try:
                unenroll_student_from_group(group, sid, request.user)
                results.append(sid)
            except Exception as e:
                errors.append({"student_id": sid, "error": str(e)})
                
        return Response({
            "status": f"{len(results)} ta o'quvchi muvaffaqiyatli chiqarildi",
            "results": results,
            "errors": errors
        }, status=200)

    @action(detail=True, methods=['post'], url_path='bulk-archive')
    def bulk_archive(self, request, pk=None):
        from archivebase.services import move_student_to_archive
        group = self.get_object()
        student_ids = request.data.get('student_ids', [])
        
        if not isinstance(student_ids, list):
            return Response({"error": "student_ids list bo'lishi kerak"}, status=400)
            
        results = []
        errors = []
        
        for sid in student_ids:
            try:
                student = Student.objects.filter(id=sid).first()
                if student:
                    move_student_to_archive(student, request.user, reason=f"{group.name} guruhidan butunlay o'chirildi (Bulk Archive)")
                    results.append(sid)
                else:
                    errors.append({"student_id": sid, "error": "O'quvchi topilmadi"})
            except Exception as e:
                errors.append({"student_id": sid, "error": str(e)})
                
        return Response({
            "status": f"{len(results)} ta o'quvchi butunlay arxivlandi",
            "results": results,
            "errors": errors
        }, status=200)

    @action(detail=True, methods=['post'])
    def add_student(self, request, pk=None):
        group = self.get_object()
        data = request.data.copy()
        data['group'] = group.id
        serializer = StudentSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            student = serializer.save()
            GroupEnrollment.objects.get_or_create(student=student, group=group)
            
        return Response(StudentNestedSerializer(student).data, status=201)

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """Guruhdagi o'quvchilar ro'yxati (Optimallashtirilgan)"""
        group = self.get_object()
        # Faqat guruhda active bo'lgan, arxivlanmagan va faol o'quvchilarni olish
        active_student_ids = list(group.enrollments.filter(is_active=True).values_list('student_id', flat=True))
        students = Student.objects.filter(id__in=active_student_ids, is_archived=False, is_active=True)
        
        # To'lov ma'lumotlarini bitta so'rovda olish (N+1 muammosini oldini olish)
        from finance.models import Payment
        today = timezone.now().date()
        month_start = today.replace(day=1)
        
        student_ids = list(students.values_list('id', flat=True))
        payments = Payment.objects.filter(
            student_id__in=student_ids,
            month=month_start,
            group=group
        ).values('student_id', 'id', 'is_paid')

        
        payment_map = {p['student_id']: p for p in payments}
        
        # Enrollment sanalarini olish
        enrollment_map = {e.student_id: e.joined_at for e in group.enrollments.all()}
        
        serializer = StudentGroupListSerializer(
            students, 
            many=True, 
            context={'payment_map': payment_map, 'enrollment_map': enrollment_map}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='lesson-dates')
    def lesson_dates(self, request, pk=None):
        """Guruhning berilgan oydagi dars kunlarini qaytaradi (Davomat olingan kunlarni ham qo'shadi)"""
        group = self.get_object()
        today = timezone.localdate()
        year = int(request.query_params.get('year', today.year))
        month = int(request.query_params.get('month', today.month))
        
        # 1. Rejadagi dars kunlari + Maxsus dars kunlari
        dates = group.get_lesson_dates(year, month)
        
        # 2. Rejada bo'lmagan, lekin davomat olingan (tasdiqlangan) kunlarni ham qo'shish
        from homework_attends.models import Attendance
        attendance_dates = Attendance.objects.filter(
            group=group, 
            date__year=year, 
            date__month=month,
            marked_by__isnull=False # Faqat tasdiqlangan davomatlarni olamiz
        ).values_list('date', flat=True).distinct()
        
        all_dates = set(dates) | set(attendance_dates)
        
        # Kelajakdagi dars kunlarini chiqarmaymiz
        final_dates = [d for d in all_dates if d <= today]
        
        # Eng yangi sanalar birinchi chiqishi uchun teskari tartibda qaytaramiz
        return Response([d.strftime('%Y-%m-%d') for d in sorted(final_dates, reverse=True)])

    @action(detail=True, methods=['post'], url_path='cancel-lesson')
    def cancel_lesson(self, request, pk=None):
        """Guruh uchun dars kuni bekor qilish"""
        import logging
        logger = logging.getLogger(__name__)
        group = self.get_object()
        date_str = request.data.get('date')
        reason = request.data.get('reason', "")
        
        try:
            from datetime import datetime
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            canceled, created = cancel_lesson_day(group, date, request.user, reason)
            
            if created:
                return Response({"status": "Dars kuni bekor qilindi"}, status=201)
            else:
                return Response({"status": "Dars kuni allaqachon bekor qilingan, sabab yangilandi"}, status=200)
                
        except Exception as e:
            logger.exception("Cancel lesson error")
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='reactivate-lesson')
    def reactivate_lesson(self, request, pk=None):
        """Guruh uchun bekor qilingan dars kunini qayta faollashtirish"""
        import logging
        logger = logging.getLogger(__name__)
        group = self.get_object()
        date_str = request.data.get('date')
        
        try:
            from datetime import datetime
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            success = reactivate_lesson_day(group, date, request.user)
            
            if success:
                return Response({"status": "Dars kuni qayta faollashtirildi"}, status=200)
            else:
                return Response({"detail": "Ushbu sana uchun bekor qilingan dars yo'q"}, status=404)
                
        except Exception as e:
            logger.exception("Reactivate lesson error")
            return Response({"error": str(e)}, status=400)






    @action(detail=True, methods=['get'], url_path='additional-mentors')
    def additional_mentors(self, request, pk=None):
        """Guruhning qo'shimcha mentorlari"""
        group = self.get_object()
        assignments = group.additional_mentors.all()
        serializer = MentorAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='assign-additional-mentor', permission_classes=[IsAdminOrSuperAdmin])
    def assign_additional_mentor(self, request, pk=None):
        group = self.get_object()
        serializer = AssignAdditionalMentorSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        mentor = get_object_or_404(User, id=serializer.validated_data['mentor'], role='mentor')
        
        assignment, created = MentorGroupAssignment.objects.get_or_create(
            mentor=mentor, group=group, defaults={'assigned_by': request.user}
        )
        if created:
            return Response({"status": "Mentor tayinlandi"}, status=201)
        return Response({"detail": "Allaqachon tayinlangan"}, status=200)

    @action(detail=True, methods=['post'], url_path='add-special-lesson')
    def add_special_lesson(self, request, pk=None):
        """Guruhga qo'shimcha dars kuni qo'shish"""
        group = self.get_object()
        date_str = request.data.get('date')
        
        if not date_str:
            return Response({"detail": "Sana (date) majburiy"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            lesson_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Sana formati noto'g'ri (YYYY-MM-DD)"}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import SpecialLessonDay
        obj, created = SpecialLessonDay.objects.get_or_create(
            group=group, 
            date=lesson_date,
            defaults={'added_by': request.user}
        )
        
        if not created:
            return Response({"detail": "Ushbu sana allaqachon dars kuni sifatida qo'shilgan"}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({"status": "Qo'shimcha dars kuni qo'shildi", "date": date_str}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='special-lessons')
    def special_lessons(self, request, pk=None):
        """Guruhning barcha qo'shimcha dars kunlarini qaytaradi"""
        group = self.get_object()
        specials = group.special_lesson_days.all().values_list('date', flat=True)
        return Response([d.strftime('%Y-%m-%d') for d in specials])



    @action(detail=True, methods=['post'], url_path='remove-additional-mentor', permission_classes=[IsAdminOrSuperAdmin])
    def remove_additional_mentor(self, request, pk=None):
        group = self.get_object()
        serializer = RemoveMentorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        MentorGroupAssignment.objects.filter(group=group, mentor_id=serializer.validated_data['mentor_id']).delete()
        return Response({"status": "Muvaffaqiyatli olib tashlandi"}, status=200)

    @action(detail=True, methods=['post'], url_path='transfer-branch', permission_classes=[IsAdminOrSuperAdmin])
    def transfer_branch(self, request, pk=None):
        """Guruhni boshqa filialga o'tkazish (mentor, o'quvchilar, davomat, to'lovlar bilan)"""
        from branches.models import Branch
        from django.contrib.auth import get_user_model
        
        group = self.get_object()
        new_branch_id = request.data.get('new_branch_id')
        reason = request.data.get('reason', "Guruh filialga o'tkazildi")
        
        if not new_branch_id:
            return Response({"error": "Yangi filial ID'si majburiy"}, status=400)
        
        new_branch = get_object_or_404(Branch, id=new_branch_id)
        
        # Check if we're trying to transfer to the same branch
        if group.branch_id == new_branch_id:
            return Response({"error": "Guruh allaqachon shu filialda"}, status=400)
        
        with transaction.atomic():
            # 1. Guruh branchini yangilash
            old_branch = group.branch
            group.branch = new_branch
            group.save()
            
            # 2. O'quvchilar branchini yangilash (faqat ushbu guruhda faol bo'lganlarni)
            from groups.models import GroupEnrollment
            active_students = Student.objects.filter(
                enrollments__group=group,
                enrollments__is_active=True
            ).distinct()
            for student in active_students:
                # Agar o'quvchi faqat ushbu guruhda bo'lsa, branchini yangilaymiz
                active_groups_count = GroupEnrollment.objects.filter(
                    student=student, 
                    is_active=True
                ).count()
                if active_groups_count == 1:
                    student.branch = new_branch
                    student.save()
            
            # 3. Davomat, to'lovlar, vazifalar, mock testlar: ular guruhga bog'langanligi uchun o'zgarishsiz qoladi
            # chunki biz guruhning branchini yangiladik, ular esa guruh orqali branchga bog'langan
            
            # 4. Transfer tarixi uchun (agar kerak bo'lsa, yangi model yaratish mumkin)
            old_branch_name = old_branch.name if old_branch else "Filial yo'q"
            logger.info(f"Guruh {group.name} ({group.id}) {old_branch_name} dan {new_branch.name} filialiga o'tkazildi. Sabab: {reason}")
            
        return Response({"status": "success", "message": "Guruh muvaffaqiyatli filialga o'tkazildi"}, status=200)

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        reason = request.data.get("reason", "Guruh arxivlandi")
        from archivebase.services import move_group_to_archive
        try:
            move_group_to_archive(group, request.user, reason=reason)
            return Response({"detail": "Arxivlandi"}, status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class StudentViewSet(viewsets.ModelViewSet):
    """O'quvchilarni boshqarish ViewSet"""
    # BUG #2 FIX: is_active=True va is_archived=False filtrlari qo'shildi.
    # Avval .all() ishlatilgani uchun arxivlangan va o'chirilgan o'quvchilar ham
    # qidiruvda va ro'yxatda chiqar edi.
    queryset = Student.objects.select_related('group', 'branch').filter(
        is_active=True, is_archived=False
    )
    serializer_class = StudentSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsStudentGroupOwnerOrSuperAdmin]
    module_name = 'students'

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'phone']
    filterset_fields = ['group', 'branch']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        
        if user.role == 'super_admin': 
            return qs
            
        if user.role == 'admin':
            # BUG #4 FIX: Qidiruv paytida ham filial cheklovi saqlanadi.
            # Avval search bo'lsa filial filtridan o'tib, admin butun bazani ko'ra olardi.
            # Faqat retrieve (ID bo'yicha ko'rish) uchun cheklov olib tashlanadi —
            # bu dublikat topish funksiyasi uchun zarur.
            if self.action == 'retrieve':
                return qs

            allowed_branches = [user.branch.id] if user.branch else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            
            # BUG FIX: Q(groups__branch_id__in=...) — barcha GroupEnrollment larni
            # (is_active=False ham) ko'rib chiqadi. Faqat FAOL enrollmentlardagi filiallarni
            # tekshirish uchun enrollments__ reverse relation ishlatamiz.
            from .models import GroupEnrollment as GE
            
            return qs.filter(
                Q(branch_id__in=allowed_branches) | 
                Q(enrollments__is_active=True, enrollments__group__branch_id__in=allowed_branches)
            ).distinct()
            
        if user.role == 'mentor':
            # Check if mentor has 'students' permission
            try:
                perms = user.staff_permissions.permissions or {}
                has_students_perm = bool(perms.get('students', False))
            except:
                has_students_perm = False
                
            if has_students_perm:
                allowed_branches = [user.branch.id] if user.branch else []
                if hasattr(user, 'branch_accesses'):
                    allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
                
                # BUG FIX: is_active=True bo'lgan enrollmentlar orqali filtr
                return qs.filter(
                    Q(branch_id__in=allowed_branches) | 
                    Q(enrollments__is_active=True, enrollments__group__branch_id__in=allowed_branches)
                ).distinct()

            # BUG FIX: groups__mentor va groups__additional_mentors — is_active filtrisiz.
            # Mentor faqat FAOL guruhlaridagi o'quvchilarni ko'rishi kerak.
            return qs.filter(
                Q(group__mentor=user) | 
                Q(enrollments__is_active=True, enrollments__group__mentor=user) | 
                Q(enrollments__is_active=True, enrollments__group__additional_mentors__mentor=user)
            ).distinct()
            
        return Student.objects.none()

    @action(detail=True, methods=['post'], url_path='transfer-group')
    def transfer_group(self, request, pk=None):
        student = self.get_object()
        new_group_id = request.data.get('new_group_id')
        from_group_id = request.data.get('from_group_id')
        reason = request.data.get('reason', "Guruhdan guruhga o'tkazildi")
        try:
            transfer_student_to_group(student, new_group_id, request.user, reason, from_group_id=from_group_id)
            return Response({"status": "success", "message": "Ko'chirildi"}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['get'])
    def transfers(self, request, pk=None):
        """O'quvchining transferlar tarixini ko'rish"""
        student = self.get_object()
        from .serializers import GroupTransferSerializer
        transfers = student.transfers.all()
        serializer = GroupTransferSerializer(transfers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='disconnect-bot')
    def disconnect_bot(self, request, pk=None):
        """O'quvchini Telegram botdan uzish"""
        student = self.get_object()
        
        from telegram_bot.models import BotProfile
        BotProfile.objects.filter(student=student).delete()
        
        student.telegram_id = None
        student.save(update_fields=['telegram_id'])
        
        return Response({"status": "success", "message": "Botdan muvaffaqiyatli uzildi"}, status=200)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        student_ids = request.data.get('student_ids', [])
        if not student_ids:
            return Response({"error": "Talabalar tanlanmagan"}, status=400)
        
        students = self.get_queryset().filter(id__in=student_ids)
        count = students.count()
        students.delete()
        
        return Response({"status": "success", "message": f"{count} ta o'quvchi o'chirildi"}, status=200)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrSuperAdmin])
    def merge(self, request, pk=None):
        master = self.get_object()
        duplicate_id = request.data.get('duplicate_id')
        try:
            merge_student_profiles(master, duplicate_id)
            return Response({"status": "success", "message": "Birlashtirildi"}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['get'], url_path='growth_statistics')
    def growth_statistics(self, request):
        from django.utils import timezone
        from archivebase.models import ArchivedStudent
        from branches.models import Branch

        branch_id = request.query_params.get('branch_id')
        today = timezone.localdate()
        data = []

        uz_months = {
            1: 'Yan', 2: 'Fev', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Iyun',
            7: 'Iyul', 8: 'Avg', 9: 'Sen', 10: 'Okt', 11: 'Noy', 12: 'Dek'
        }

        for i in range(5, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1

            joined_qs = Student.objects.filter(joined_at__year=y, joined_at__month=m)
            archived_qs = ArchivedStudent.objects.filter(archived_at__year=y, archived_at__month=m)

            if branch_id:
                joined_qs = joined_qs.filter(branch_id=branch_id)
                branch = Branch.objects.filter(id=branch_id).first()
                if branch:
                    archived_qs = archived_qs.filter(branch_name=branch.name)

            month_name = f"{uz_months[m]} {y}"

            data.append({
                "name": month_name,
                "Kelganlar": joined_qs.count(),
                "Ketganlar": archived_qs.count()
            })

        return Response(data)

    def destroy(self, request, *args, **kwargs):
        student = self.get_object()
        reason = request.data.get("reason", "O'chirildi")
        from archivebase.services import move_student_to_archive
        try:
            move_student_to_archive(student, request.user, reason=reason)
            return Response({"detail": "Arxivlandi"}, status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class MentorViewSet(viewsets.ModelViewSet):
    """Mentorlarni boshqarish"""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    queryset = User.objects.filter(role='mentor').select_related('branch')
    serializer_class = MentorSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsAuthenticated, IsMentorBranchAccessible]
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'username']

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        branch_id = self.request.query_params.get('branch_id')

        if branch_id:
            # Ham asosiy branchi, ham BranchAccess orqali biriktirilgan branchi bo'yicha qidiramiz
            qs = qs.filter(Q(branch_id=branch_id) | Q(branch_accesses__branch_id=branch_id)).distinct()

        if user.role == 'admin':
            allowed = [user.branch_id] if user.branch_id else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return qs.filter(Q(branch_id__in=allowed) | Q(branch_accesses__branch_id__in=allowed)).distinct()
        return qs

class StudentNestedView(viewsets.ReadOnlyModelViewSet):
    """Studentlar haqida batafsil ma'lumot (ReadOnly)"""
    # BUG #2 FIX (StudentNestedView): is_active=True, is_archived=False filtrlari qo'shildi.
    # prefetch_related 'groups' o'rniga 'enrollments' ishlatildi (is_active filter qo'llash uchun)
    queryset = Student.objects.select_related('group', 'branch').filter(
        is_active=True, is_archived=False
    ).order_by('full_name')
    serializer_class = StudentNestedSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'phone']

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        branch_id = self.request.query_params.get('branch_id')
        
        is_special = self.request.query_params.get('is_special')
        if is_special == 'true':
            qs = qs.exclude(status='regular')

        if user.role == 'super_admin':
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            return qs
            
        if user.role == 'admin':
            # BUG #4 FIX (StudentNestedView): Qidiruv paytida ham filial cheklovi saqlanadi.
            # Faqat retrieve (ID bo'yicha ko'rish) uchun cheklov olib tashlanadi.
            if self.action == 'retrieve':
                return qs

            allowed_branches = [user.branch_id] if user.branch_id else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            
            # BUG FIX: is_active=True bo'lgan enrollmentlar orqali filtr
            qs = qs.filter(
                Q(branch_id__in=allowed_branches) | 
                Q(enrollments__is_active=True, enrollments__group__branch_id__in=allowed_branches)
            ).distinct()
            
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
                
            return qs
            
        if user.role == 'mentor':
            # Check if mentor has 'students' permission
            try:
                perms = user.staff_permissions.permissions or {}
                has_students_perm = bool(perms.get('students', False))
            except:
                has_students_perm = False
                
            if has_students_perm:
                allowed_branches = [user.branch_id] if user.branch_id else []
                if hasattr(user, 'branch_accesses'):
                    allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
                
                # BUG FIX: is_active=True bo'lgan enrollmentlar orqali filtr
                mentor_qs = qs.filter(
                    Q(branch_id__in=allowed_branches) | 
                    Q(enrollments__is_active=True, enrollments__group__branch_id__in=allowed_branches)
                ).distinct()
                
                if branch_id:
                    mentor_qs = mentor_qs.filter(branch_id=branch_id)
                return mentor_qs

            # Faqat o'ziga tegishli o'quvchilarni qaytaradi
            # BUG FIX: groups__mentor — is_active filtrisiz. Faqat faol guruhlar.
            mentor_qs = qs.filter(
                Q(group__mentor=user) | 
                Q(enrollments__is_active=True, enrollments__group__mentor=user) |
                Q(enrollments__is_active=True, enrollments__group__additional_mentors__mentor=user)
            ).distinct()
            if branch_id:
                mentor_qs = mentor_qs.filter(branch_id=branch_id)
            return mentor_qs
            
        return Student.objects.none()

class WaitingStudentViewSet(viewsets.ModelViewSet):
    """Kutishlar zali"""
    queryset = WaitingStudent.objects.all().order_by('full_name')
    serializer_class = WaitingStudentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'phone', 'subject']

    def get_queryset(self):
        user = self.request.user
        branch_id = self.request.query_params.get('branch_id') or self.request.query_params.get('branch')
        qs = self.queryset

        if user.role == 'super_admin':
            if branch_id:
                return qs.filter(branch_id=branch_id)
            return qs

        if user.role == 'admin':
            allowed = [user.branch_id] if user.branch_id else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            qs = qs.filter(branch_id__in=allowed)
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            return qs

        return qs.filter(branch=user.branch)

    @action(detail=True, methods=['post'], url_path='assign-to-group')
    def assign_to_group(self, request, pk=None):
        waiting_student = self.get_object()
        group_id = request.data.get('group_id')
        try:
            student = assign_waiting_student_to_group(waiting_student, group_id, request.user)
            return Response({"message": "Guruhga qo'shildi", "student_id": student.id}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        reason = request.query_params.get('reason', '') or request.data.get('reason', '') or "Kutish zalidan o'chirildi"
        from archivebase.services import move_lid_to_archive
        move_lid_to_archive(instance, request.user, reason)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        student_ids = request.data.get('student_ids', [])
        if not student_ids:
            return Response({"error": "Talabalar tanlanmagan"}, status=400)
        
        students = self.get_queryset().filter(id__in=student_ids)
        count = 0
        from archivebase.services import move_lid_to_archive
        reason = request.data.get('reason', 'Guruhli o\'chirish (Kutish zali)')
        for student in students:
            move_lid_to_archive(student, request.user, reason)
            count += 1
        
        return Response({"status": "success", "message": f"{count} ta o'quvchi o'chirildi va arxivlandi"}, status=200)

class AdminViewSet(viewsets.ReadOnlyModelViewSet):
    """Adminlar ro'yxati (ReadOnly)"""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    queryset = User.objects.filter(role='admin').distinct()
    serializer_class = AdminUserSerializers
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        branch_id = self.request.query_params.get('branch_id')
        
        if branch_id:
            # Asosiy branchi yoki BranchAccess orqali biriktirilgan branchi bo'lgan adminlar
            qs = qs.filter(Q(branch_id=branch_id) | Q(branch_accesses__branch_id=branch_id)).distinct()
        
        if user.role == 'super_admin': 
            return qs
        
        if user.branch:
            allowed = list(user.branch_accesses.values_list('branch_id', flat=True))
            allowed.append(user.branch.id)
            if not branch_id:
                qs = qs.filter(Q(branch_id__in=allowed) | Q(branch_accesses__branch_id__in=allowed))
            return qs
        
        return qs.none()

class GroupSimpleViewSet(viewsets.ReadOnlyModelViewSet):
    """Guruhlar ro'yxati (oddiy)"""
    queryset = Group.objects.all()
    serializer_class = GroupSimpleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = [
        'name', 
        'subject', 
        'group_type',
        'days',
        'dars_kunlari',
        'dars_vaqti',
        'mentor__first_name', 
        'mentor__last_name', 
        'mentor__username'
    ]

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset.filter(is_archived=False)
        branch_id = self.request.query_params.get('branch_id')

        if user.role == 'super_admin':
            # Super admin: branch_id berilgan bo'lsa, faqat shu filial guruhlarini qaytarish
            if branch_id and branch_id not in ['undefined', 'null', '']:
                qs = qs.filter(branch_id=branch_id)
            return qs

        if user.role == 'admin':
            allowed = [user.branch.id] if user.branch else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            qs = qs.filter(branch_id__in=allowed)
            # Admin ham qo'shimcha branch_id parametri bilan filter qilishi mumkin
            if branch_id and branch_id not in ['undefined', 'null', '']:
                qs = qs.filter(branch_id=branch_id)
            return qs

        if user.role == 'mentor':
            # Mentor: faqat o'ziga tegishli guruhlar (asosiy yoki qo'shimcha mentor)
            qs = qs.filter(Q(mentor=user) | Q(additional_mentors__mentor=user)).distinct()
            # branch_id berilgan bo'lsa, faqat shu filialning guruhlarini qaytarish
            if branch_id and branch_id not in ['undefined', 'null', '']:
                qs = qs.filter(branch_id=branch_id)
            return qs

        return qs.none()

class MentorListViewSet(viewsets.ReadOnlyModelViewSet):
    """Mentorlar ro'yxati (oddiy)"""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    queryset = User.objects.filter(role='mentor').select_related('branch')
    serializer_class = MentorListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'username']

    def get_queryset(self):
        user = self.request.user
        branch_id = self.request.query_params.get('branch_id')
        qs = self.queryset

        if branch_id:
            # Faqat tanlangan branchga aloqador mentorlar (asosiy yoki ruxsati bor)
            qs = qs.filter(Q(branch_id=branch_id) | Q(branch_accesses__branch_id=branch_id)).distinct()

        if user.role == 'super_admin': 
            return qs
            
        if user.role == 'admin':
            allowed = [user.branch_id] if user.branch_id else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return qs.filter(Q(branch_id__in=allowed) | Q(branch_accesses__branch_id__in=allowed)).distinct()
            
        return qs.filter(id=user.id)

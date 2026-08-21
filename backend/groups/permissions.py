from rest_framework import permissions
from django.db import models
from .models import MentorGroupAssignment
from authenticatsiya.models import BranchAccess

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'super_admin'

class IsAdminOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['admin', 'super_admin']

class IsGroupOwnerOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        
        if user.role == 'super_admin':
            return True

        if user.role == 'admin':
            # 1. Asosiy filiali tekshiramiz
            if user.branch == obj.branch:
                return True
            
            # 2. BranchAccess orqali qo'shimcha ruxsatlarni tekshiramiz
            return user.branch_accesses.filter(branch=obj.branch).exists()

        if user.role == 'mentor':
            is_owner = (
                obj.mentor == user or
                obj.additional_mentors.filter(mentor=user).exists()
            )
            
            if is_owner:
                # Mentor o'z guruhini ko'ra oladi va undagi amallarni bajara oladi (davomat, enrollment, unenrollment)
                if request.method in permissions.SAFE_METHODS or request.method == 'POST':
                    return True
                
                # Guruhni o'zi tahrirlash (PUT/PATCH) yoki o'chirish (DELETE) uchun 'groups' ruxsati kerak bo'lishi mumkin
                try:
                    perms = user.staff_permissions.permissions or {}
                    return bool(perms.get('groups', False))
                except:
                    return False
        
        return False

class IsStudentGroupOwnerOrSuperAdmin(permissions.BasePermission):
    """
    STUDENT uchun:
    - super_admin → faqat READ
    - admin → o‘z branch'idagi studentlar
    - mentor → asosiy mentor YOKI qo‘shimcha mentor
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.role == 'super_admin':
            return True
            
        # Admin va Mentor uchun StaffPermission orqali modul ruxsatini tekshiramiz
        try:
            perms = user.staff_permissions.permissions or {}
        except:
            perms = {}
            
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Yozish amallari (POST, PUT, PATCH, DELETE) uchun tekshiramiz
        if user.role == 'mentor':
            has_students_perm = bool(perms.get('students', False))
            if request.method == 'POST':
                # Yangi student yaratish uchun ruxsat kerak
                return has_students_perm
            # PUT, PATCH, DELETE uchun has_permission dan o'tkazamiz,
            # has_object_permission orqali o'zining studentlarini boshqarishi tekshiriladi
            return True
            
        if user.role == 'admin':
            # Adminlarga o'chirish (DELETE) uchun ruxsat yo'q, agar u super_admin bo'lmasa yoki maxsus ruxsati bo'lmasa
            # Lekin bizda adminlar o'z filialidagi studentlarni o'chira olishi kerak bo'lsa:
            return True
            
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == 'super_admin':
            return True

        # Admin boshqara oladigan filiallar ID ro'yxati
        allowed_branches = []
        if user.branch_id:
            allowed_branches.append(user.branch_id)
        if hasattr(user, 'branch_accesses'):
            allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))

        # 1. Studentning o'z filiali ruxsat berilganlar ichidami?
        student_main_branch = obj.branch_id
        
        # Super admin, admin, yoki 'students' ruxsatiga ega mentor uchun filialni tekshiramiz
        try:
            perms = user.staff_permissions.permissions or {}
        except:
            perms = {}
            
        has_students_perm = False
        if user.role == 'mentor':
            has_students_perm = bool(perms.get('students', False))
            
        if user.role in ['super_admin', 'admin'] or (user.role == 'mentor' and has_students_perm):
            if student_main_branch in allowed_branches:
                return True
                
            # 2. Student qatnashayotgan guruhlardan birortasi Admin/Ruxsatli Mentor filialidami?
            if obj.groups.filter(branch_id__in=allowed_branches).exists():
                return True

        # Mentor o'zining ruxsati bo'lmagan holda, faqat o'z guruhidagi o'quvchilarni tahrirlay oladi
        if user.role == 'mentor':
            # Mentor o'z o'quvchisini o'chira olishi uchun (agar unga students ruxsati berilgan bo'lsa)
            if request.method == 'DELETE' and not has_students_perm:
                return False

            # Mentor uchun:
            # 1) Yangi M2M (student.groups) orqali biriktirilgan guruhlar
            in_m2m_groups = obj.groups.filter(
                models.Q(mentor=user) |
                models.Q(additional_mentors__mentor=user)
            ).exists()
            if in_m2m_groups:
                return True

            # 2) Legacy FK (student.group) bo'yicha ham tekshiramiz
            legacy_group = getattr(obj, 'group', None)
            if not legacy_group:
                return False

            is_primary_mentor = legacy_group.mentor_id == user.id
            is_additional_mentor = legacy_group.additional_mentors.filter(mentor=user).exists()
            return is_primary_mentor or is_additional_mentor

        # Qo'shimcha ravishda: Admin barcha o'quvchilarni FAQAT ko'ra olishi mumkin (Dossier uchun)
        if request.method in permissions.SAFE_METHODS and user.role == 'admin':
            return True

        return False
    
class IsAdminOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'admin' and
            request.user.branch is not None
        )


class IsMentorBranchAccessible(permissions.BasePermission):
    """
    Mentor o'zining asosiy filialiga va unga ruxsat berilgan (BranchAccess) 
    filiallarga kirishi uchun ruxsat beruvchi permission.
    Shuningdek super_admin va adminlarga ham ruxsat beradi.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin, Admin va Mentorlar bu view'dan foydalanishi mumkin
        return request.user.role in ['super_admin', 'admin', 'mentor']

    def has_object_permission(self, request, view, obj):
        user = request.user
        
        if user.role == 'super_admin':
            return True

        target_branch_id = getattr(obj, 'branch_id', None)
        
        if target_branch_id is None and hasattr(obj, 'branch'):
            target_branch_id = obj.branch.id

        if user.role == 'admin':
            # 1. Adminning o'z branchi mentorniki bilan bir xil bo'lsa
            if user.branch_id == target_branch_id:
                return True
            # 2. Adminning mentor branchiga BranchAccess ruxsati bo'lsa
            if user.branch_accesses.filter(branch_id=target_branch_id).exists():
                return True
            # 3. Mentor adminning branchlaridan biriga BranchAccess orqali biriktirilgan bo'lsa
            #    (boshqa filialdan ko'chirilgan/yuborilgan mentorlar uchun)
            allowed_branches = [user.branch_id] if user.branch_id else []
            allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return BranchAccess.objects.filter(user=obj, branch_id__in=allowed_branches).exists()

        if user.role == 'mentor':
            if user.branch_id == target_branch_id:
                return True
            return BranchAccess.objects.filter(user=user, branch_id=target_branch_id).exists()
            
        return False
from rest_framework import permissions

class IsAdminUserRole(permissions.BasePermission):
    """Faqat Admin roli borlar uchun o'zgartirish ruxsati"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.role == 'admin' or request.user.role == 'mentor')

class IsStaffOrMentor(permissions.BasePermission):
    """Admin, SuperAdmin va Mentorlar ko'ra olishi uchun"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ['admin', 'super_admin', 'mentor']
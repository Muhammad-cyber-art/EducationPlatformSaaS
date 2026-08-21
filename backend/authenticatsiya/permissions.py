# permissions.py
from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'super_admin'


class IsSuperAdminOrAdmin(permissions.BasePermission):
    """
    SuperAdmin va Adminlarga ruxsat beradi.
    Xodimlarni filiallararo transfer qilish uchun ishlatiladi.
    Admin faqat mentorlarni transfer qilishi mumkin (view/serializer darajasida cheklanadi).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.role in ['super_admin', 'admin']
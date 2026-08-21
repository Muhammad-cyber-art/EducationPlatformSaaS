from rest_framework import permissions

class IsArchiveAdmin(permissions.BasePermission):
    """
    Faqat 'admin' rolidagilar va SuperAdminlar uchun ruxsat beruvchi permission.
    """
    def has_permission(self, request, view):
        # 1. Foydalanuvchi tizimga kirgan bo'lishi shart
        if not request.user or not request.user.is_authenticated:
            return False
        # 2. Agar SuperAdmin bo'lsa, har doim ruxsat beramiz
        if request.user.is_superuser:
            return True
        # 3. Foydalanuvchi modelidagi 'role' maydonini tekshiramiz
        # Eslatma: User modelida 'role' fieldi bor deb hisoblaymiz
        return getattr(request.user, 'role', None) == 'admin'
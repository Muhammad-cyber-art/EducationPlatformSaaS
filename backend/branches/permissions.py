from rest_framework.permissions import BasePermission

class IsSuperAdminOnly(BasePermission):
    """
    Bu API ga faqat Super Admin (is_superuser=True) kira oladi.
    Boshqa hech kim (Admin, Mentor) kira olmaydi (na o'qiy oladi, na yozadi).
    """

    def has_permission(self, request, view):
        # 1. User login qilganmi?
        if not request.user or not request.user.is_authenticated:
            return False

        # 2. User tizimning bosh Super Adminimi?
        # is_superuser - bu Django da 'createsuperuser' bilan yaratilgan eng katta admin.
        return request.user.is_superuser
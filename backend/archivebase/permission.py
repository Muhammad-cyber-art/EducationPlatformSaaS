from rest_framework import permissions

class IsArchiveAdmin(permissions.BasePermission):
    """
    Super Admin va Admin rollariga arxiv ma'lumotlari bilan to'liq ishlashga ruxsat beruvchi permission.
    """
    def has_permission(self, request, view):
        # 1. Foydalanuvchi autentifikatsiyadan o'tgan bo'lishi shart
        if not request.user or not request.user.is_authenticated:
            return False
            
        user_role = getattr(request.user, 'role', None)

        # 2. Django is_superuser yoki role == 'super_admin' bo'lsa to'liq ruxsat
        if request.user.is_superuser or user_role == 'super_admin':
            return True

        # 3. Admin roli bo'lsa to'liq ruxsat
        if user_role == 'admin':
            try:
                staff_perm = getattr(request.user, 'staff_permissions', None)
                if staff_perm and staff_perm.permissions:
                    # Agar 'archive' moduli ruxsatlar ichida aniq False qilib o'chirilgan bo'lsa
                    if staff_perm.permissions.get('archive') is False:
                        return False
            except Exception:
                pass
            return True

        return False
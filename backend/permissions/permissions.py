# permissions/permissions.py
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

class IsSuperAdmin(permissions.BasePermission):
    """
    Faqat 'super_admin' rolidagi foydalanuvchilarga to'liq ruxsat.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', None) == 'super_admin'
        )

class IsAdmin(permissions.BasePermission):
    """
    Faqat 'admin' rolidagi foydalanuvchilarga ruxsat.
    Aniqroq ruxsatlar uchun HasModulePermission bilan birga ishlatilishi kerak.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', None) == 'admin'
        )

class HasModulePermission(permissions.BasePermission):
    """
    View darajasida modul nomini aniqlab, foydalanuvchida 
    shu modul uchun kerakli amal (action) ga ruxsat borligini tekshiradi.
    
    Viewda ishlatish:
    class MyView(APIView):
        permission_classes = [HasModulePermission]
        module_name = 'finance'  # Modul nomi shu yerda ko'rsatiladi
    """
    
    def has_permission(self, request, view):
        # 1. Avtorizatsiyadan o'tmagan bo'lsa darhol rad etamiz
        if not request.user or not request.user.is_authenticated:
            return False

        # 2. Super adminlarga doimiy ruxsat
        if request.user.role == 'super_admin':
            return True

        # StaffPermission obyektini olamiz
        try:
            staff_perm = request.user.staff_permissions
            perms = staff_perm.permissions or {}
        except Exception:
            perms = {}

        module_name = getattr(view, 'module_name', None)
        if not module_name:
            # Agar modul nomi ko'rsatilmagan bo'lsa, faqat super_admin kira oladi
            return False

        # Ruxsatlarni tekshirish logikasi
        user_role = request.user.role
        
        # 3. Moliya (finance) moduli uchun:
        if module_name == 'finance':
            if user_role == 'super_admin':
                return True
            
            # Adminlarga barcha finance view'lari uchun ruxsat beramiz
            if user_role == 'admin':
                return True
            
            # Mentorlar uchun: faqat EmployeePaymentViewSet va StudentPaymentViewSet
            view_class_name = view.__class__.__name__
            if view_class_name in ['EmployeePaymentViewSet', 'StudentPaymentViewSet']:
                return True
            
            # Boshqa finance view'lari mentorlar uchun emas
            return False

        # Modul bo'yicha ruxsat bormi?
        has_module_access = bool(perms.get(module_name))

        if user_role == 'admin':
            # Adminlarga barcha modullar uchun ruxsat beramiz
            return True

        if user_role == 'mentor':
            # Mentorlar 'homework' modulida hamisha ruxsatga ega
            if module_name == 'homework':
                return True
            
            # Agar boshqa modulga (students, groups) ruxsat berilgan bo'lsa:
            if has_module_access:
                return True
            
            # Aks holda faqat ko'rish (SAFE_METHODS)
            return request.method in permissions.SAFE_METHODS

        return False

from django.contrib import admin
from .models import UserModel
from django.contrib.auth.admin import UserAdmin

# authentication/admin.py

from .models import BranchAccess

# @admin.register(BranchAccess)
# class BranchAccessAdmin(admin.ModelAdmin):
#     list_display = ('user', 'branch', 'access_level', 'granted_by', 'created_at')
#     list_filter = ('access_level', 'branch', 'granted_by')
#     search_fields = ('user__username', 'user__first_name', 'branch__name')
#     autocomplete_fields = ('user', 'branch')  # Tez qidirish uchun
#     readonly_fields = ('created_at',)

#     def get_queryset(self, request):
#         qs = super().get_queryset(request)
#         if request.user.role == 'super_admin':
#             return qs
#         return qs.filter(granted_by=request.user)  # Oddiy admin faqat o'zi berganlarni ko'rsin


@admin.register(UserModel)
class UserModelAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_active', 'created_at', 'updated_at')
    list_filter = ('role', 'is_active')
    search_fields = ('username', 'email')
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ('branch',)
    

from django.contrib import admin
from .models import AdminAccess, StaffPermission

@admin.register(AdminAccess)
class AdminAccessAdmin(admin.ModelAdmin):
    list_display = ('user', 'can_download_daily_report', 'can_view_payments', 'can_edit_students', 'can_delete_data')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')

@admin.register(StaffPermission)
class StaffPermissionAdmin(admin.ModelAdmin):
    list_display = ('user', 'short_permissions_summary')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')

    def short_permissions_summary(self, obj):
        # Permissions jsonni chiroyli ko'rsatish
        return str(obj.permissions)[:50] + "..." if len(str(obj.permissions)) > 50 else str(obj.permissions)
    short_permissions_summary.short_description = "Permissions"

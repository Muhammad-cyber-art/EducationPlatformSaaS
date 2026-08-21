from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import Payment, EmployeePayment, StaffProfile, MentorGroupSalaryConfig

User = get_user_model()


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = [
        'user', 
        'user_role', 
        'salary_type',
        'get_salary_display_admin',
        'karta'
    ]
    
    list_editable = ['salary_type']
    
    list_filter = ['salary_type', 'user__role', 'user__branch']
    
    search_fields = ['user__username', 'user__first_name', 'user__last_name']
    
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Xodim', {
            'fields': ('user',)
        }),
        ('Maosh turi', {
            'fields': ('salary_type',),
            'description': 'Belgilangan maosh yoki foiz tanlang'
        }),
        ('Maosh sozlamalari', {
            'fields': ('fixed_salary', 'commission_percentage', 'per_student_amount'),
            'description': 'Agar "Belgilangan oylik" bo\'lsa fixed_salary to\'ldiring. Agar "Foiz asosida" bo\'lsa commission_percentage to\'ldiring. Agar "O\'quvchilar soni bo\'yicha" bo\'lsa per_student_amount to\'ldiring.'
        }),
        ('Qo\'shimcha', {
            'fields': ('karta', 'created_at', 'updated_at')
        }),
    )
    
    # MUHIM: Foydalanuvchi tanlayotganda faqat xodimlarni chiqarish
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "user":
            kwargs["queryset"] = User.objects.filter(role__in=['mentor', 'admin'])
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if hasattr(request.user, 'role') and request.user.role == 'super_admin':
            return qs
        return qs.none()

    def user_role(self, obj):
        """Xodim roli"""
        return obj.user.get_role_display() if hasattr(obj.user, 'get_role_display') else obj.user.role
    user_role.short_description = "Lavozim"
    
    def get_salary_display_admin(self, obj):
        """Maosh ma'lumoti"""
        if obj.salary_type == 'fixed':
            return f"{int(obj.fixed_salary):,} so'm".replace(',', '.')
        elif obj.salary_type == 'percentage':
            return f"{obj.commission_percentage}%"
        elif obj.salary_type == 'student_count':
            return f"{int(obj.per_student_amount):,} so'm/o'quvchi".replace(',', '.')
        return ""
    get_salary_display_admin.short_description = "Maosh"


@admin.register(EmployeePayment)
class EmployeePaymentAdmin(admin.ModelAdmin):
    list_display = [
        'employee', 
        'employee_role',
        'month', 
        'salary_base', 
        'bonus', 
        'deductions', 
        'get_total_display', 
        'is_paid', 
        'paid_at'
    ]
    
    list_filter = ['is_paid', 'month', 'employee__role', 'employee__branch']
    
    search_fields = ['employee__username', 'employee__first_name', 'employee__last_name']
    
    readonly_fields = ['total_amount', 'paid_at', 'marked_by', 'created_at']
    
    date_hierarchy = 'month'
    
    fieldsets = (
        ('Xodim ma\'lumotlari', {
            'fields': ('employee', 'month')
        }),
        ('Maosh tafsilotlari', {
            'fields': ('salary_base', 'bonus', 'deductions', 'total_amount'),
            'description': 'Asosiy maosh, bonus va ayirmalar'
        }),
        ('To\'lov holati', {
            'fields': ('is_paid', 'paid_at', 'marked_by')
        }),
        ('Qo\'shimcha', {
            'fields': ('created_at',)
        }),
    )
    
    # Admin panelda bittada "To'landi" deb belgilash tugmasini qo'shish
    actions = ['mark_as_paid_selected']

    @admin.action(description="Tanlanganlarni to'landi deb belgilash")
    def mark_as_paid_selected(self, request, queryset):
        if not hasattr(request.user, 'role') or request.user.role != 'super_admin':
            self.message_user(request, "Faqat super_admin bu amalni bajara oladi", level='error')
            return
        
        count = 0
        for payment in queryset.filter(is_paid=False):
            payment.mark_as_paid(request.user)
            count += 1
        
        self.message_user(request, f"{count} ta maosh to'landi deb belgilandi")

    def get_queryset(self, request):
        if hasattr(request.user, 'role') and request.user.role == 'super_admin':
            return super().get_queryset(request).select_related('employee', 'employee__branch', 'marked_by')
        return EmployeePayment.objects.none()
    
    def employee_role(self, obj):
        """Xodim lavozimi"""
        return obj.employee.get_role_display() if hasattr(obj.employee, 'get_role_display') else obj.employee.role
    employee_role.short_description = "Lavozim"
    
    def get_total_display(self, obj):
        """Jami to'lov (formatlangan)"""
        return f"{obj.total_amount:,.0f} so'm".replace(',', '.')


@admin.register(MentorGroupSalaryConfig)
class MentorGroupSalaryConfigAdmin(admin.ModelAdmin):
    list_display = [
        'mentor', 
        'group', 
        'salary_type', 
        'commission_percentage', 
        'per_student_amount',
        'created_at'
    ]
    
    list_filter = ['salary_type', 'mentor__branch', 'group__branch']
    
    search_fields = ['mentor__username', 'mentor__first_name', 'mentor__last_name', 'group__name']
    
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Mentor va Guruh', {
            'fields': ('mentor', 'group')
        }),
        ('Maosh turi va sozlamalari', {
            'fields': ('salary_type', 'commission_percentage', 'per_student_amount'),
            'description': 'Foiz asosida bo\'lsa commission_percentage, o\'quvchilar soni bo\'yicha bo\'lsa per_student_amount to\'ldiring'
        }),
        ('Qo\'shimcha', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    # Mentor tanlashda faqat mentorlarni, guruh tanlashda esa mentorning guruhlarini chiqarish (optional)
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "mentor":
            kwargs["queryset"] = User.objects.filter(role='mentor')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if hasattr(request.user, 'role') and request.user.role == 'super_admin':
            return qs.select_related('mentor', 'group', 'mentor__branch', 'group__branch')
        return qs.none()

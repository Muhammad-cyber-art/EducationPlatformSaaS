# permissions/serializers.py
from rest_framework import serializers
from .models import AdminAccess, StaffPermission
from django.contrib.auth import get_user_model

User = get_user_model()

class AdminAccessSerializer(serializers.ModelSerializer):
    """
    Super_admin tomonidan admin ruxsatlarini boshqarish uchun asosiy serializer.
    """
    class Meta:
        model = AdminAccess
        fields = [
            'id', 
            'user', 
            'can_download_daily_report', 
            'can_view_payments', 
            'can_edit_students', 
            'can_delete_data'
        ]
        read_only_fields = ['id', 'user'] # Foydalanuvchini o'zgartirib bo'lmaydi, faqat ruxsatlarni

    def update(self, instance, validated_data):
        # Bu yerda qo'shimcha mantiq yozish mumkin
        return super().update(instance, validated_data)


class AdminAccessCompactSerializer(serializers.ModelSerializer):
    """
    Token ichiga joylash uchun yoki front-endda tezkor tekshiruvlar 
    uchun ixcham (short keys) ko'rinish.
    """
    class Meta:
        model = AdminAccess
        fields = [
            'can_download_daily_report', 
            'can_view_payments', 
            'can_edit_students'
        ]

    def to_representation(self, instance):
        return {
            "dl_rep": instance.can_download_daily_report,
            "vw_pay": instance.can_view_payments,
            "ed_stu": instance.can_edit_students,
            "del_dt": instance.can_delete_data,
        }

class StaffPermissionSerializer(serializers.ModelSerializer):
    """
    Soddalashtirilgan Serializer.
    Faqat True/False (Checkbox) orqali modullarga to'liq ruxsat berish yoki olish.
    """
    username = serializers.CharField(source='user.username', read_only=True)
    
    # Simple Boolean Fields (Checkbox)
    finance = serializers.BooleanField(default=False, label="Moliya (Finance)")
    groups = serializers.BooleanField(default=False, label="Guruhlar (Groups)")
    students = serializers.BooleanField(default=False, label="Talabalar (Students)")
    teachers = serializers.BooleanField(default=False, label="O'qituvchilar (Teachers)")
    branches = serializers.BooleanField(default=False, label="Filiallar (Branches)")
    reports = serializers.BooleanField(default=False, label="Hisobotlar (Reports)")
    homework = serializers.BooleanField(default=False, label="Vazifalar va Davomat (Homework)")
    pay_slip = serializers.BooleanField(default=False, label="Oylik maosh kvitansiyasi (Pay Slip)")

    class Meta:
        model = StaffPermission
        fields = [
            'id', 'user', 'username', 'finance', 'groups', 'students', 
            'teachers', 'branches', 'reports', 'homework', 'pay_slip'
        ]
        read_only_fields = ['id', 'user'] 

    def to_representation(self, instance):
        """
        Bazadagi JSON ni Boolean ga o'giramiz.
        Agar modulda biror ruxsat bo'lsa -> True
        Bo'lmasa -> False
        Agar foydalanuvchi super_admin bo'lsa -> Hamma ruxsatlar True
        """
        ret = super().to_representation(instance)
        
        # Super admin hamma narsaga ruxsatga ega
        if instance.user.role == 'super_admin':
            for module in ['finance', 'groups', 'students', 'teachers', 'branches', 'reports', 'homework', 'pay_slip']:
                ret[module] = True
            return ret

        perms = instance.permissions or {}
        
        # Modul kaliti bormi va bo'sh emasmi?
        ret['finance'] = bool(perms.get('finance'))
        ret['groups'] = bool(perms.get('groups'))
        ret['students'] = bool(perms.get('students'))
        ret['teachers'] = bool(perms.get('teachers'))
        ret['branches'] = bool(perms.get('branches'))
        ret['reports'] = bool(perms.get('reports'))
        ret['homework'] = bool(perms.get('homework'))
        ret['pay_slip'] = bool(perms.get('pay_slip'))
        
        return ret

    def validate(self, attrs):
        """
        Boolean qiymatlarni JSON ga o'giramiz.
        True -> Hammasiga ruxsat (view, create, edit, delete)
        False -> Ruxsat yo'q
        """
        permissions_json = {}
        all_actions = ["view", "create", "edit", "delete"]
        
        modules = ['finance', 'groups', 'students', 'teachers', 'branches', 'reports', 'homework', 'pay_slip']
        for module in modules:
            # Agar True bo'lsa, full access beramiz
            if attrs.get(module):
                permissions_json[module] = all_actions
                # Attrs dan olib tashlaymiz, modelda bu fieldlar yo'q
                
            # Attrs dan tozalash (baribir modelda yo'q)
            if module in attrs:
                del attrs[module]
        
        attrs['permissions'] = permissions_json
        return attrs

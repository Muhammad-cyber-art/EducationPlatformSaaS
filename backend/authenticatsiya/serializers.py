from rest_framework import serializers
from .models import UserModel
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from branches.serializers import BranchSerializer
from branches.models import Branch
from drf_spectacular.utils import extend_schema_field
User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=UserModel._meta.get_field('branch').remote_field.model.objects.all(),
        source='branch',  # Kelgan ID 'branch' ob'ekti sifatida validated_data ga tushadi
        required=False, 
        allow_null=True
    )

    class Meta:
        model = UserModel
        fields = (
            'id', 'username', 'first_name', 'last_name',
            'subject', 'phone_number', 'color','image','role', 'branch_id', 'password'
        )
        extra_kwargs = {
            "password": {"write_only": True, "required": False}, # Update uchun False
            "username": {"required": True}
        }

    def get_allowed_branch_ids(self, user):
        """User ruxsatga ega bo'lgan barcha filial IDlarini qaytaradi"""
        allowed_ids = []
        if user.branch_id:
            allowed_ids.append(user.branch_id)
        
        # BranchAccess orqali qo'shimcha filiallar
        extra_ids = user.branch_accesses.values_list('branch_id', flat=True)
        allowed_ids.extend(list(extra_ids))
        return list(set(allowed_ids))

    def create(self, validated_data):
        request = self.context.get('request')
        current_user = request.user
        
        # 'source=branch' bo'lgani uchun validated_data['branch'] deb olinadi
        requested_branch = validated_data.pop('branch', None)
        password = validated_data.pop('password', None)

        if not password:
            raise serializers.ValidationError({"password": "Parol bo'lishi shart."})
        
        # Password validation
        if len(password) < 8:
            raise serializers.ValidationError({"password": "Parol kamida 8 ta belgidan iborat bo'lishi kerak."})
        
        # Username sanitization (XSS oldini olish)
        username = validated_data.get('username', '')
        if '<' in username or '>' in username or 'script' in username.lower():
            raise serializers.ValidationError({"username": "Username xavfli belgilar o'z ichiga olmaydi."})

        # Filialni aniqlash logikasi
        final_branch = None
        if current_user.role == 'super_admin':
            final_branch = requested_branch
        elif current_user.role == 'admin':
            allowed_ids = self.get_allowed_branch_ids(current_user)
            # Agar tanlangan filial ruxsatlar ichida bo'lsa
            if requested_branch and requested_branch.id in allowed_ids:
                final_branch = requested_branch
            else:
                # Aks holda adminning asosiy filiali
                final_branch = current_user.branch
        
        # User yaratish
        user = UserModel.objects.create_user(
            branch=final_branch,
            password=password,
            **validated_data
        )
        return user

    def update(self, instance, validated_data):
        request = self.context.get('request')
        current_user = request.user

        # Ma'lumotlarni ajratib olamiz
        password = validated_data.pop('password', None)
        requested_branch = validated_data.pop('branch', None)

        # 1. Filialni yangilash logikasi
        if current_user.role == 'super_admin':
            if requested_branch is not None:
                instance.branch = requested_branch
        elif current_user.role == 'admin':
            # Admin xodimlarni boshqa filialga ko'chira olmaydi
            if requested_branch is not None and getattr(instance.branch, 'id', None) != requested_branch.id:
                raise serializers.ValidationError({"branch_id": "Sizda xodimlarni boshqa filialga ko'chirish huquqi yo'q."})

        # 2. Parolni yangilash
        if password and password.strip():
            instance.set_password(password)

        old_phone = instance.phone_number
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if old_phone != instance.phone_number:
            from telegram_bot.models import BotProfile
            BotProfile.objects.filter(user=instance).delete()
            
        instance.save()
        return instance

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import BranchAccess  # Yangi modelni import qilamiz

class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_or_email = attrs.get('username')
        if username_or_email and '@' in username_or_email:
            # Email orqali foydalanuvchini qidiramiz
            user = UserModel.objects.filter(email=username_or_email).first()
            if user:
                # Topilsa, attrs['username'] ni haqiqiy username'ga almashtiramiz
                attrs['username'] = user.username
        
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # OLDINGI KODLARINGIZ (o'zgartirilmadi)
        token['role'] = user.role
        token['is_superuser'] = user.is_superuser
        token['branch_id'] = user.branch.id if user.branch else None
        token['branch_name'] = user.branch.name if user.branch else None

        # YANGI: Qo'shimcha branch accesslari
        if user.role == 'super_admin' or user.is_superuser:
            # Super_admin hamma branch larni ko'ra oladi
            from branches.models import Branch
            all_branches = Branch.objects.all().values('id', 'name')
            token['accessible_branches'] = [
                {
                    'branch_id': b['id'],
                    'branch_name': b['name'],
                    'access_level': 'admin'
                }
                for b in all_branches
            ]
        else:
            # Oddiy admin/mentor uchun ruxsatlar ro'yxati
            accessible_list = []
            
            # 1. FOYDALANUVCHINING ASOSIY FILIALI (agar bo'lsa)
            if user.branch:
                accessible_list.append({
                    'branch_id': user.branch.id,
                    'branch_name': user.branch.name,
                    'access_level': user.role  # admin yoki mentor ekanligini bildiradi
                })

            # 2. BRANCH ACCESS MODELIDAN QO'SHIMCHA FILIALLAR
            # select_related('branch') orqali bazaga so'rovni optimallashtiramiz
            accesses = BranchAccess.objects.filter(user=user).select_related('branch')
            
            for access in accesses:
                # Agar asosiy filial allaqachon ro'yxatga qo'shilgan bo'lsa, qayta qo'shmaymiz
                if user.branch and access.branch.id == user.branch.id:
                    continue
                
                accessible_list.append({
                    'branch_id': access.branch.id,
                    'branch_name': access.branch.name,
                    'access_level': getattr(access, 'access_level', user.role) 
                    # agar BranchAccess modelida access_level bo'lmasa, foydalanuvchi rolini oladi
                })

            token['accessible_branches'] = accessible_list

        return token
    
class UsersListSerializer(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        required=True,
        allow_null=True
    )
    class Meta:
        model = User
        fields = ["id", "username", "first_name", 'color','image', "last_name","is_active", "date_joined", "role",
            "phone_number", "subject",'branch','branch_id', "is_staff"
        ]
class CurrentUserSerializer(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()
    accessible_branches = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username",  'color','image',"first_name", "last_name","is_active", "date_joined", "role",
            "phone_number", "subject",'branch', "is_staff", "is_superuser", "permissions", "accessible_branches"
        ]
        read_only_fields = ["is_staff","is_active",]

    from drf_spectacular.utils import extend_schema_field
    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_accessible_branches(self, obj) -> list:
        """Admin/mentor uchun asosiy filial + BranchAccess orqali ruxsat berilgan filiallar."""
        from .models import BranchAccess
        out = []
        if obj.branch:
            out.append({"branch_id": obj.branch.id, "branch_name": obj.branch.name, "access_level": getattr(obj, 'role', None)})
        for acc in BranchAccess.objects.filter(user=obj).select_related('branch'):
            if obj.branch and acc.branch_id == obj.branch_id:
                continue
            out.append({"branch_id": acc.branch.id, "branch_name": acc.branch.name, "access_level": getattr(acc, 'access_level', obj.role)})
        return out

    @extend_schema_field(serializers.DictField())
    def get_permissions(self, obj) -> dict:
        """
        Permissions ni soddalashtirilgan Boolean formatda qaytaradi.
        Masalan: {finance: true, groups: false, ...}
        """
        try:
            from permissions.models import StaffPermission
            sp = StaffPermission.objects.get(user=obj)
            
            # Super admin hamma narsaga ruxsatga ega
            if obj.role == 'super_admin' or obj.is_superuser:
                return {
                    'finance': True,
                    'groups': True,
                    'students': True,
                    'teachers': True,
                    'branches': True,
                    'reports': True,
                    'homework': True,
                    'pay_slip': True
                }
            
            perms = sp.permissions or {}
            
            # Modul kaliti bormi va bo'sh emasmi? -> True, aks holda False
            return {
                'finance': bool(perms.get('finance')),
                'groups': bool(perms.get('groups')),
                'students': bool(perms.get('students')),
                'teachers': bool(perms.get('teachers')),
                'branches': bool(perms.get('branches')),
                'reports': bool(perms.get('reports')),
                'homework': bool(perms.get('homework')),
                'pay_slip': bool(perms.get('pay_slip'))
            }
        except Exception:
            return {
                'finance': False,
                'groups': False,
                'students': False,
                'teachers': False,
                'branches': False,
                'reports': False,
                'homework': False,
                'pay_slip': False
            }

# authentication/serializers.py



class BranchAccessSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(write_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    # branch_id ni write_only qilib, queryset beramiz
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        write_only=True
    )
    
    # branch obyektini to'liq qaytarish uchun
    branch = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BranchAccess
        fields = [
            'id',
            'user_id',
            'user_username',
            'branch_id',
            'branch',
            'access_level',
            'granted_by',
            'created_at'
        ]
        read_only_fields = ['granted_by', 'created_at']
    
    @extend_schema_field(serializers.DictField())
    def get_branch(self, obj) -> dict:
        """Branch obyektini to'liq ma'lumot bilan qaytarish"""
        if obj.branch:
            return {
                'id': obj.branch.id,
                'name': obj.branch.name,
                'address': obj.branch.address if hasattr(obj.branch, 'address') else None
            }
        return None

    def validate(self, data):
        request = self.context.get('request')
        if not request:
            raise serializers.ValidationError("So'rov topilmadi.")

        user = request.user

        # Super admin va admin ruxsatga ega
        if user.role not in ['super_admin', 'admin']:
            raise serializers.ValidationError(
                "Faqat super_admin yoki admin ruxsat bera oladi."
            )

        user_id = data['user_id']
        branch = data['branch_id']  # Bu yerda Branch object keladi

        if BranchAccess.objects.filter(user_id=user_id, branch=branch).exists():
            raise serializers.ValidationError("Bu foydalanuvchiga ushbu branch uchun allaqachon ruxsat berilgan.")

        return data

    def create(self, validated_data):
        # branch_id ni Branch object sifatida olamiz va to'g'ridan-to'g'ri ishlatamiz
        branch = validated_data.pop('branch_id')
        user_id = validated_data.pop('user_id')
        
        request = self.context.get('request')
        
        branch_access = BranchAccess.objects.create(
            user_id=user_id,
            branch=branch,  # Bu yerda Branch object beriladi – to'g'ri!
            access_level=validated_data['access_level'],
            granted_by=request.user
        )
        return branch_access
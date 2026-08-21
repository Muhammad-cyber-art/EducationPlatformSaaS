from rest_framework import status, viewsets, permissions, filters
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied ,ValidationError

from .serializers import (
    RegisterSerializer, LoginSerializer, UsersListSerializer, 
    CurrentUserSerializer, BranchAccessSerializer
)
from .models import UserModel, BranchAccess
from rest_framework_simplejwt.views import TokenObtainPairView
User = get_user_model()


# Custom permission logic (keyin permission class sifatida ishlatamiz)
def get_user_role(user):
    return user.role if hasattr(user, 'role') else None



class RegisterViewSet(ModelViewSet):
    queryset = UserModel.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['role', 'branch']
    search_fields = ['username', 'first_name', 'last_name']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return UserModel.objects.none()
        user = self.request.user
        if user.role == 'super_admin': 
            return UserModel.objects.select_related('branch').all()
        
        # Admin ko'ra oladigan filiallar
        allowed = list(user.branch_accesses.values_list('branch_id', flat=True))
        if user.branch_id: 
            allowed.append(user.branch_id)
        
        if user.role == 'admin':
            # BranchAccess orqali ko'chirilgan mentorlarni ham ko'rish
            return UserModel.objects.filter(
                Q(branch_id__in=allowed) | Q(branch_accesses__branch_id__in=allowed)
            ).exclude(role='super_admin').select_related('branch').distinct()
        return UserModel.objects.filter(id=user.id).select_related('branch')

    def create(self, request, *args, **kwargs):
        """Ruxsatlarni tekshirish logikasi"""
        current_user = request.user
        target_role = request.data.get('role', 'mentor')

        if current_user.role == 'super_admin':
            pass 
        elif current_user.role == 'admin':
            # Admin faqat mentor yarata olishi haqidagi cheklov
            if target_role != 'mentor':
                return Response(
                    {"detail": "Admin faqat mentor qo'sha oladi."},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            return Response(
                {"detail": "Sizda foydalanuvchi yaratish huquqi yo'q."},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """branch_id ni saqlash logikasi (Tuzatilgan)"""
        user = self.request.user
        requested_branch_id = self.request.data.get('branch_id')

        # 1. Super Admin uchun logika
        if user.role == 'super_admin':
            if requested_branch_id:
                serializer.save(branch_id=requested_branch_id)
            else:
                serializer.save() # Agar super_admin branch_id yubormasa null ketaveradi
            return

        # 2. Admin uchun ruxsat berilgan filialni tekshirish
        allowed = list(user.branch_accesses.values_list('branch_id', flat=True))
        if user.branch_id: 
            allowed.append(user.branch_id)

        # ID ni integerga o'girib tekshiramiz (xavfsizlik uchun)
        try:
            valid_requested_id = int(requested_branch_id) if requested_branch_id else None
        except (ValueError, TypeError):
            valid_requested_id = None

        if valid_requested_id and valid_requested_id in allowed:
            serializer.save(branch_id=valid_requested_id)
        else:
            # Agar ruxsati yo'q filialni yuborgan bo'lsa yoki yubormagan bo'lsa
            # o'zining asosiy filialiga biriktiriladi
            serializer.save(branch_id=user.branch_id)

    from drf_spectacular.utils import extend_schema
    @extend_schema(responses={200: UsersListSerializer(many=True)})
    @action(detail=False, methods=['get'], url_path='admins')
    def list_admins(self, request):
        # Super admin va adminlar ko'ra oladi
        branch_id = request.query_params.get('branch_id')
        
        if request.user.role == 'super_admin':
            admins = UserModel.objects.filter(role='admin').select_related('branch')
            if branch_id:
                admins = admins.filter(Q(branch_id=branch_id) | Q(branch_accesses__branch_id=branch_id)).distinct()
        elif request.user.role == 'admin':
            # Admin faqat o'zi ruxsatga ega filiallardagi adminlarni ko'radi
            allowed_branches = []
            if request.user.branch_id:
                allowed_branches.append(request.user.branch_id)
            allowed_branches.extend(
                request.user.branch_accesses.values_list('branch_id', flat=True)
            )
            admins = UserModel.objects.filter(
                Q(role='admin') & 
                (Q(branch_id__in=allowed_branches) | Q(branch_accesses__branch_id__in=allowed_branches))
            ).select_related('branch').distinct()
            if branch_id:
                admins = admins.filter(Q(branch_id=branch_id) | Q(branch_accesses__branch_id=branch_id)).distinct()
        else:
            return Response({"detail": "Faqat Super Admin yoki Admin ko'ra oladi."}, status=403)
        serializer = UsersListSerializer(admins, many=True)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        if self.request.user.role != 'super_admin':
            raise PermissionDenied("Faqat Super Admin foydalanuvchilarni o'chira oladi.")
        reason = self.request.query_params.get('reason', "Admin tomonidan o'chirildi")
        from archivebase.services import send_to_archive
        send_to_archive(instance, request_user=self.request.user, reason=reason)

    @action(detail=True, methods=['post'], url_path='remove-from-branch')
    def remove_from_branch(self, request, pk=None):
        """
        Mentorni asosiy filialidan o'chirish.
        Faqat super_admin va admin uchun ruxsat etilgan.
        Mentor branch = null bo'ladi (filialdan ajratiladi).
        """
        user = request.user
        if user.role not in ['super_admin', 'admin']:
            return Response(
                {"detail": "Bu amal uchun ruxsatingiz yo'q."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            target_user = self.get_object()
        except Exception:
            return Response({"detail": "Foydalanuvchi topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        if target_user.role == 'super_admin':
            return Response(
                {"detail": "Super adminni filialdan olib tashlash mumkin emas."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Admin uchun: faqat o'zi ruxsatga ega filiallardan olib tashlashi mumkin
        if user.role == 'admin':
            allowed = []
            if user.branch_id:
                allowed.append(user.branch_id)
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            if target_user.branch_id not in allowed:
                return Response(
                    {"detail": "Siz ushbu filialga ruxsatingiz yo'q."},
                    status=status.HTTP_403_FORBIDDEN
                )

        old_branch_name = target_user.branch.name if target_user.branch else "Noma'lum"
        target_user.branch = None
        target_user.save(update_fields=['branch'])

        return Response(
            {"detail": f"{target_user.get_full_name() or target_user.username} '{old_branch_name}' filialidan muvaffaqiyatli olib tashlandi."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='remove-branch-access')
    def remove_branch_access(self, request, pk=None):
        """
        Mentordan qo'shilgan (BranchAccess) filialni o'chirish.
        """
        user = request.user
        if user.role not in ['super_admin', 'admin']:
            return Response(
                {"detail": "Bu amal uchun ruxsatingiz yo'q."},
                status=status.HTTP_403_FORBIDDEN
            )

        branch_id = request.data.get('branch_id')
        if not branch_id:
            return Response({"detail": "branch_id kiritilishi shart."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = self.get_object()
        except Exception:
            return Response({"detail": "Foydalanuvchi topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        # Admin ruxsatlarini tekshirish
        if user.role == 'admin':
            allowed = []
            if user.branch_id:
                allowed.append(user.branch_id)
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            if int(branch_id) not in allowed:
                return Response(
                    {"detail": "Siz ushbu filialga ruxsatingiz yo'q."},
                    status=status.HTTP_403_FORBIDDEN
                )

        try:
            from .models import BranchAccess
            access = BranchAccess.objects.get(user=target_user, branch_id=branch_id)
            access.delete()
            return Response({"detail": "Qo'shilgan filialdan muvaffaqiyatli o'chirildi."}, status=status.HTTP_200_OK)
        except BranchAccess.DoesNotExist:
            return Response({"detail": "Bunday filial ruxsati topilmadi."}, status=status.HTTP_404_NOT_FOUND)

class UsersListView(ListAPIView):
    """Mentorlar ro'yxatini olish uchun (BranchAccess inobatga olingan)"""
    serializer_class = UsersListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return UserModel.objects.none()
        user = self.request.user
        
        if user.role == 'super_admin':
            return UserModel.objects.select_related('branch').all()

        allowed_branches = []
        if user.branch_id: allowed_branches.append(user.branch_id)
        allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))

        # BranchAccess orqali ko'chirilgan mentorlarni ham ko'rish
        return UserModel.objects.filter(
            role='mentor',
        ).filter(
            Q(branch_id__in=allowed_branches) | Q(branch_accesses__branch_id__in=allowed_branches)
        ).select_related('branch').distinct()

class CurrentUserView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user
from .permissions import IsSuperAdmin, IsSuperAdminOrAdmin

class BranchAccessViewSet(ModelViewSet):
    queryset = BranchAccess.objects.all().select_related('user', 'branch', 'granted_by')
    serializer_class = BranchAccessSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrAdmin]

    def get_queryset(self):
        """
        Agar user_id parametri berilgan bo'lsa, shu xodimning barcha filiallarini qaytaradi.
        Bu profilda xodimning qaysi filiallarda ishlashini ko'rsatish uchun kerak.
        Admin uchun: faqat o'zi ruxsatga ega bo'lgan filiallardagi BranchAccess yozuvlarini ko'radi.
        """
        queryset = super().get_queryset()
        user = self.request.user

        # Admin uchun: faqat o'ziga ruxsat berilgan filiallardagi yozuvlarni qaytaramiz
        if user.role == 'admin':
            allowed_branches = []
            if user.branch_id:
                allowed_branches.append(user.branch_id)
            allowed_branches.extend(
                user.branch_accesses.values_list('branch_id', flat=True)
            )
            queryset = queryset.filter(
                Q(branch_id__in=allowed_branches) | Q(user__branch_id__in=allowed_branches)
            )

        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset

    def _get_admin_allowed_branch_ids(self, user):
        """Admin ruxsatga ega bo'lgan filial ID'larini qaytaradi."""
        allowed = []
        if user.branch_id:
            allowed.append(user.branch_id)
        allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
        return list(set(allowed))

    def _check_admin_transfer_allowed(self, user, validated_data):
        """
        Admin uchun transfer cheklovlarini tekshiradi:
        - Faqat mentorlarni transfer qilishi mumkin (adminlarni emas)
        - Faqat o'zi ruxsatga ega bo'lgan filiallar orasida transfer qilishi mumkin
        """
        target_user_id = validated_data.get('user_id')
        target_branch = validated_data.get('branch_id')  # Branch object

        # Admin faqat mentorlarni transfer qilishi mumkin
        try:
            target_user = UserModel.objects.get(id=target_user_id)
        except UserModel.DoesNotExist:
            raise PermissionDenied("Ko'rsatilgan foydalanuvchi topilmadi.")

        if target_user.role != 'mentor':
            raise PermissionDenied("Admin faqat mentorlarni boshqa filialga o'tkaza oladi.")

        allowed_branch_ids = self._get_admin_allowed_branch_ids(user)

        # Target user ning hozirgi filiali admin ruxsatlarida bo'lishi kerak
        if target_user.branch_id and target_user.branch_id not in allowed_branch_ids:
            raise PermissionDenied("Siz ushbu mentorning hozirgi filialiga ruxsatingiz yo'q.")

        # Yangi filial ham admin ruxsatlarida bo'lishi kerak
        target_branch_id = target_branch.id if hasattr(target_branch, 'id') else target_branch
        if target_branch_id not in allowed_branch_ids:
            raise PermissionDenied("Siz ko'rsatilgan yangi filialga ruxsatingiz yo'q.")

    def perform_create(self, serializer):
        user = self.request.user

        if user.role == 'admin':
            # Admin uchun qo'shimcha cheklovlar
            self._check_admin_transfer_allowed(user, serializer.validated_data)
        # Super admin uchun cheklov yo'q (oldingi mantiq)
        
        # Biriktirilayotgan user 'mentor' yoki 'admin' ekanligini tekshirish
        target_user = serializer.validated_data.get('user')
        if target_user and target_user.role not in ['mentor', 'admin']:
            raise ValidationError("Branch faqat mentor yoki adminlarga biriktirilishi mumkin.")

        serializer.save(granted_by=self.request.user)

    def check_super_admin(self):
        if self.request.user.role != 'super_admin':
            raise PermissionDenied("Faqat super_admin uchun ruxsat etilgan.")

    def _check_admin_or_super_admin(self):
        """Super admin yoki admin rolini tekshiradi."""
        user = self.request.user
        if user.role in ['super_admin', 'admin']:
            return
        raise PermissionDenied("Bu amal uchun ruxsatingiz yo'q.")

    def perform_update(self, serializer):
        self._check_admin_or_super_admin()
        
        # Admin uchun qo'shimcha cheklovlar
        if self.request.user.role == 'admin':
            self._check_admin_transfer_allowed(self.request.user, serializer.validated_data)

        target_user = serializer.validated_data.get('user')
        if target_user and target_user.role not in ['mentor', 'admin']:
            raise ValidationError("Faqat mentor yoki adminlarga branch biriktirish mumkin.")
            
        serializer.save()

    def perform_destroy(self, instance):
        """
        Xodimni filialdan olib tashlash.
        Muhim: Asosiy filialdan (user.branch) olib tashlashga ruxsat bermaymiz.
        """
        self._check_admin_or_super_admin()
        
        # Admin uchun: faqat o'zi ruxsatga ega filiallardan olib tashlashi mumkin
        user = self.request.user
        if user.role == 'admin':
            allowed_branch_ids = self._get_admin_allowed_branch_ids(user)
            if instance.branch_id not in allowed_branch_ids:
                raise PermissionDenied("Siz ushbu filialdan olib tashlash huquqiga ega emassiz.")
            # Admin faqat mentorlarni olib tashlashi mumkin
            if instance.user.role != 'mentor':
                raise PermissionDenied("Admin faqat mentorlarni filialdan olib tashlay oladi.")
        
        # Xavfsizlik: Asosiy filialdan olib tashlashni oldini olish
        if instance.user.branch and instance.branch.id == instance.user.branch.id:
            raise ValidationError({
                "detail": "Xodimni asosiy filialidan olib tashlash mumkin emas. Avval boshqa filialga asosiy filial sifatida transfer qiling."
            })
        
        instance.delete()

    
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer

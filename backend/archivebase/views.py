from django.shortcuts import render, get_object_or_404
from .permission import IsArchiveAdmin
# Create your views here.
from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ArchivedStudent, ArchivedStaff, ArchivedGroup, PaymentArchive, ArchivedLid
from .serializers import (
    ArchivedStudentSerializer, ArchivedStaffSerializer, ArchivedGroupSerializer, 
    PaymentArchiveSerializer, ArchivedLidSerializer
)
from .services import send_to_archive
from .services import (
    restore_student_from_archive,
    restore_staff_from_archive,
    restore_group_from_archive,
    restore_lid_from_archive
)
from rest_framework import filters # Qidiruv uchun
from django_filters.rest_framework import DjangoFilterBackend # Filtr uchun
from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class ArchivedStudentViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """Faqat ko'rish va o'chirish (Arxivdan butunlay)"""
    serializer_class = ArchivedStudentSerializer
    permission_classes = [IsArchiveAdmin] # Faqat adminlar uchun
    pagination_class = StandardResultsSetPagination
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'branch_name', 'last_group_name']

    def get_queryset(self):
        # Kutish zaliga o'tkazilganlarni asosiy arxiv ro'yxatidan yashiramiz
        return ArchivedStudent.objects.exclude(reason__startswith="[WAITING_HALL]").order_by('-archived_at')
    
    def destroy(self, request, *args, **kwargs):
        """
        Arxivdan butunlay o'chirish.
        Ruxsat: Super Admin va Admin
        """
        user = request.user
        if user.role not in ['super_admin', 'admin']:
            return Response(
                {"error": "Juda uzr, faqat admin va super_admin o'chira oladi"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        Arxivlangan studentni qayta tiklash.
        Ruxsat: Super Admin va Admin
        """
        user = request.user
        
        # Ruxsat tekshirish
        if user.role not in ['super_admin', 'admin']:
            return Response(
                {"error": "Faqat admin va super_admin tiklashi mumkin"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        archived = self.get_object()
        
        try:
            student = restore_student_from_archive(archived.id, user)
            archived.delete() # Arxivdan o'chirish
            return Response({
                "success": True,
                "message": f"{student.full_name} muvaffaqiyatli tiklandi",
                "student_id": student.id
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {"error": f"Tiklashda xato: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='bulk-restore')
    def bulk_restore(self, request):
        """Ko'plab o'quvchilarni bir vaqtda arxivdan tiklash"""
        user = request.user
        if user.role not in ['super_admin', 'admin']:
            return Response({"error": "Faqat adminlar tiklashi mumkin"}, status=403)
            
        ids = request.data.get('ids', [])
        results = []
        errors = []
        
        for sid in ids:
            try:
                archived = ArchivedStudent.objects.filter(id=sid).first()
                if archived:
                    student = restore_student_from_archive(archived.id, user)
                    archived.delete()
                    results.append(sid)
            except Exception as e:
                errors.append({"id": sid, "error": str(e)})
                
        return Response({"status": f"{len(results)} ta o'quvchi tiklandi", "results": results, "errors": errors})

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Ko'plab o'quvchilarni bir vaqtda arxivdan butunlay o'chirish"""
        user = request.user
        if user.role not in ['super_admin', 'admin']:
            return Response({"error": "Faqat adminlar o'chira oladi"}, status=403)
            
        ids = request.data.get('ids', [])
        ArchivedStudent.objects.filter(id__in=ids).delete()
        return Response({"status": "O'quvchilar arxivdan butunlay o'chirildi"})

class ArchivedStaffViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ArchivedStaff.objects.all().order_by('-archived_at')
    serializer_class = ArchivedStaffSerializer
    permission_classes = [IsArchiveAdmin]
    pagination_class = StandardResultsSetPagination
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'role', 'phone']
    
    def destroy(self, request, *args, **kwargs):
        """
        Arxivdan butunlay o'chirish.
        Ruxsat: Faqat Super Admin
        """
        if request.user.role != 'super_admin':
            return Response(
                {"error": "Faqat super_admin xodimlarni butunlay o'chira oladi"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Bog'liq to'lov arxivlarini ham o'chiramiz
        instance = self.get_object()
        PaymentArchive.objects.filter(user_id=instance.original_id).delete()
        
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        Arxivlangan xodimni qayta tiklash.
        Ruxsat: Faqat Super Admin
        """
        user = request.user
        
        # Faqat super_admin tiklashi mumkin
        if user.role != 'super_admin':
            return Response(
                {"error": "Faqat super_admin xodimlarni tiklashi mumkin"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        archived = self.get_object()
        
        try:
            staff = restore_staff_from_archive(archived.id, user)
            archived.delete() # Arxivdan o'chirish
            return Response({
                "success": True,
                "message": f"{staff.get_full_name() or staff.username} muvaffaqiyatli tiklandi",
                "user_id": staff.id,
                "username": staff.username,
                "default_password": "changeme123"
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {"error": f"Tiklashda xato: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='bulk-restore')
    def bulk_restore(self, request):
        """Ko'plab xodimlarni bir vaqtda arxivdan tiklash"""
        user = request.user
        if user.role != 'super_admin':
            return Response({"error": "Faqat super_admin xodimlarni tiklashi mumkin"}, status=403)
            
        ids = request.data.get('ids', [])
        results = []
        errors = []
        
        for sid in ids:
            try:
                archived = ArchivedStaff.objects.filter(id=sid).first()
                if archived:
                    staff = restore_staff_from_archive(archived.id, user)
                    archived.delete()
                    results.append(sid)
            except Exception as e:
                errors.append({"id": sid, "error": str(e)})
                
        return Response({"status": f"{len(results)} ta xodim tiklandi", "results": results})

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Ko'plab xodimlarni bir vaqtda arxivdan butunlay o'chirish"""
        user = request.user
        if user.role != 'super_admin':
            return Response({"error": "Faqat super_admin o'chira oladi"}, status=403)
            
        ids = request.data.get('ids', [])
        ArchivedStaff.objects.filter(id__in=ids).delete()
        return Response({"status": "Xodimlar arxivdan butunlay o'chirildi"})

class ArchivedGroupViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """Arxivlangan guruhlar"""
    queryset = ArchivedGroup.objects.all().order_by('-archived_at')
    serializer_class = ArchivedGroupSerializer
    permission_classes = [IsArchiveAdmin]
    pagination_class = StandardResultsSetPagination

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'branch_name', 'mentor_name', 'subject']

    def destroy(self, request, *args, **kwargs):
        """
        Arxivdan butunlay o'chirish.
        Ruxsat: Faqat Super Admin
        """
        if request.user.role != 'super_admin':
            return Response(
                {"error": "Faqat super_admin guruhlarni butunlay o'chira oladi"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        Arxivlangan guruhni va uning o'quvchilarini qayta tiklash.
        Ruxsat: Faqat Super Admin.

        Response:
            {
                "success": true,
                "message": "...",
                "group_id": 47,
                "restored_students": 8,
                "skipped_students": 1,
                "errors": []
            }
        """
        user = request.user

        if user.role != 'super_admin':
            return Response(
                {"error": "Faqat super_admin guruhlarni tiklashi mumkin"},
                status=status.HTTP_403_FORBIDDEN
            )

        archived = self.get_object()

        try:
            result = restore_group_from_archive(archived.id, user)
            group = result['group']

            # Arxiv yozuvini o'chirish (tarix saqlash uchun ixtiyoriy)
            archived.delete()

            response_data = {
                "success": True,
                "message": (
                    f"'{group.name}' guruhi muvaffaqiyatli tiklandi. "
                    f"{result['restored_students']} ta o'quvchi ham tiklandi."
                ),
                "group_id": group.id,
                "group_name": group.name,
                "restored_students": result['restored_students'],
                "skipped_students": result['skipped_students'],
            }

            # Agar ba'zi studentlar tiklanmagan bo'lsa — xatolarni ham yuboramiz
            if result['errors']:
                response_data["warnings"] = result['errors']

            return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            return Response(
                {
                    "error": f"Tiklashda xato: {str(e)}",
                    "detail": traceback.format_exc()
                },
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='bulk-restore')
    def bulk_restore(self, request):
        """Ko'plab guruhlarni bir vaqtda arxivdan tiklash"""
        user = request.user
        if user.role != 'super_admin':
            return Response({"error": "Faqat super_admin guruhlarni tiklashi mumkin"}, status=403)
            
        ids = request.data.get('ids', [])
        results = []
        errors = []
        
        for sid in ids:
            try:
                archived = ArchivedGroup.objects.filter(id=sid).first()
                if archived:
                    group = restore_group_from_archive(archived.id, user)
                    archived.delete()
                    results.append(sid)
            except Exception as e:
                errors.append({"id": sid, "error": str(e)})
                
        return Response({"status": f"{len(results)} ta guruh tiklandi", "results": results})

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Ko'plab guruhlarni bir vaqtda arxivdan butunlay o'chirish"""
        user = request.user
        if user.role != 'super_admin':
            return Response({"error": "Faqat super_admin o'chira oladi"}, status=403)
            
        ids = request.data.get('ids', [])
        ArchivedGroup.objects.filter(id__in=ids).delete()
        return Response({"status": "Guruhlar arxivdan butunlay o'chirildi"})


class PaymentArchiveViewSet(viewsets.ModelViewSet):
    queryset = PaymentArchive.objects.all().order_by('-archived_at')
    serializer_class = PaymentArchiveSerializer
    
    # Faqat Super Admin arxivni ko'ra oladi
    def get_permissions(self):
        class DenyAll(permissions.BasePermission):
            def has_permission(self, request, view):
                return False
        
        if self.request.user and self.request.user.is_authenticated and getattr(self.request.user, 'role', '') == 'super_admin':
            return [permissions.IsAuthenticated()]
        return [DenyAll()]


from .models import ArchivedHomework
from .serializers import ArchivedHomeworkSerializer
from groups.models import Group

class ArchivedHomeworkViewSet(viewsets.ReadOnlyModelViewSet):
    """Arxivlangan uyga vazifalar (Storage)"""
    queryset = ArchivedHomework.objects.all().order_by('-archived_at')
    serializer_class = ArchivedHomeworkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        
        # Filiral/Guruh filtri
        group_id = self.request.query_params.get('group_id')
        if group_id:
            qs = qs.filter(group_id=group_id)

        if user.role == 'super_admin':
            return qs
        elif user.role == 'admin':
            # Admin faqat o'z filialini ko'radi
            branch_group_ids = Group.objects.filter(branch=user.branch).values_list('id', flat=True)
            return qs.filter(group_id__in=branch_group_ids)
        else:
            # Mentor faqat o'z guruhlarinikini ko'radi
            group_ids = list(Group.objects.filter(mentor=user).values_list('id', flat=True))
            group_ids += list(Group.objects.filter(additional_mentors__mentor=user).values_list('id', flat=True))
            return qs.filter(group_id__in=group_ids)

    @action(detail=False, methods=['delete'])
    def clear_all(self, request):
        """Ma'lum bir guruhning barcha arxivini tozalash"""
        group_id = request.query_params.get('group_id')
        if not group_id:
            return Response({"error": "group_id majburiy"}, status=400)
            
        group = get_object_or_404(Group, id=group_id)
        user = request.user
        
        # Ruxsat tekshirish
        if user.role == 'mentor':
            if not (group.mentor == user or group.additional_mentors.filter(mentor=user).exists()):
                return Response({"error": "Siz bu guruh arxivini tozalay olmaysiz"}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'admin':
            if group.branch != user.branch:
                return Response({"error": "Siz bu guruh arxivini tozalay olmaysiz"}, status=status.HTTP_403_FORBIDDEN)
        
        # O'chirish
        count, _ = ArchivedHomework.objects.filter(group_id=group_id).delete()
        return Response({
            "success": True, 
            "message": f"{count} ta ma'lumot arxivdan butunlay o'chirib tashlandi."
        })


class ArchivedLidViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """Faqat ko'rish va o'chirish (Arxivdan butunlay)"""
    queryset = ArchivedLid.objects.all().order_by('-archived_at')
    serializer_class = ArchivedLidSerializer
    permission_classes = [IsArchiveAdmin]
    pagination_class = StandardResultsSetPagination
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'branch_name', 'phone', 'subject']
    
    def get_queryset(self):
        user = self.request.user
        branch_id = self.request.query_params.get('branch_id') or self.request.query_params.get('branch')
        qs = self.queryset

        if user.role == 'super_admin':
            if branch_id:
                return qs.filter(metadata__branch_id=branch_id)
            return qs

        if user.role == 'admin':
            allowed = [user.branch_id] if user.branch_id else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            # ArchivedLid doesn't have direct branch field, but has branch_name or metadata branch_id.
            # We can filter metadata__branch_id__in or metadata__branch__in
            return qs.filter(metadata__branch_id__in=allowed)

        return qs.none()

    def destroy(self, request, *args, **kwargs):
        """
        Arxivdan butunlay o'chirish.
        Ruxsat: Super Admin va Admin
        """
        user = request.user
        if user.role not in ['super_admin', 'admin']:
            return Response(
                {"error": "Juda uzr, faqat admin va super_admin o'chira oladi"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        Arxivlangan lidni qayta tiklash.
        Ruxsat: Super Admin va Admin
        """
        user = request.user
        
        # Ruxsat tekshirish
        if user.role not in ['super_admin', 'admin']:
            return Response(
                {"error": "Faqat admin va super_admin tiklashi mumkin"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        archived = self.get_object()
        
        try:
            waiting_student = restore_lid_from_archive(archived.id, user)
            archived.delete() # Arxivdan o'chirish
            return Response({
                "success": True,
                "message": f"{waiting_student.full_name} muvaffaqiyatli tiklandi",
                "waiting_student_id": waiting_student.id
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {"error": f"Tiklashda xato: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='bulk-restore')
    def bulk_restore(self, request):
        """Ko'plab lidlarni bir vaqtda arxivdan tiklash"""
        user = request.user
        if user.role not in ['super_admin', 'admin']:
            return Response({"error": "Faqat adminlar tiklashi mumkin"}, status=403)
            
        ids = request.data.get('ids', [])
        results = []
        errors = []
        
        for sid in ids:
            try:
                archived = ArchivedLid.objects.filter(id=sid).first()
                if archived:
                    waiting_student = restore_lid_from_archive(archived.id, user)
                    archived.delete()
                    results.append(sid)
            except Exception as e:
                errors.append({"id": sid, "error": str(e)})
                
        return Response({"status": f"{len(results)} ta lid tiklandi", "results": results, "errors": errors})

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Ko'plab lidlarni bir vaqtda arxivdan butunlay o'chirish"""
        user = request.user
        if user.role not in ['super_admin', 'admin']:
            return Response({"error": "Faqat adminlar o'chira oladi"}, status=403)
            
        ids = request.data.get('ids', [])
        ArchivedLid.objects.filter(id__in=ids).delete()
        return Response({"status": "Lidlar arxivdan butunlay o'chirildi"})
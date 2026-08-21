from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated

from homework_attends.models import Homework, HomeworkSubmission
from groups.models import Group
from homework_attends.serializers import (
    HomeworkListSerializer, 
    HomeworkDetailSerializer, 
    HomeworkSubmissionUpdateSerializer
)
from homework_attends.services import create_homework_with_submissions, archive_homework
from permissions.permissions import HasModulePermission

class HomeworkViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'homework'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['group'] 

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Homework.objects.none()
        user = self.request.user
        group_id = self.request.query_params.get('group_id')
        
        if user.role == 'super_admin':
            queryset = Homework.objects.all()
        elif user.role == 'admin':
            queryset = Homework.objects.filter(group__branch=user.branch)
        else:
            # Mentor access
            group_ids = list(Group.objects.filter(mentor=user).values_list('id', flat=True))
            group_ids += list(Group.objects.filter(additional_mentors__mentor=user).values_list('id', flat=True))
            queryset = Homework.objects.filter(group_id__in=group_ids)

        if group_id:
            queryset = queryset.filter(group_id=group_id)

        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('submissions__student')

        return queryset.select_related('group').distinct()

    def get_serializer_class(self):
        if self.action == 'list':
            return HomeworkListSerializer
        if self.action == 'retrieve':
            return HomeworkDetailSerializer
        return HomeworkListSerializer

    def perform_create(self, serializer):
        user = self.request.user
        group_id = self.request.data.get('group')

        # Permission check for group
        query = models.Q(id=group_id)
        if user.role == 'mentor':
            query &= (models.Q(mentor=user) | models.Q(additional_mentors__mentor=user))
        elif user.role == 'admin':
            query &= models.Q(branch=user.branch)

        group = get_object_or_404(Group, query)
        create_homework_with_submissions(serializer, user, group)

    def perform_destroy(self, instance):
        archive_homework(instance, self.request.user)
        instance.delete()

    @action(detail=True, methods=['patch'])
    def update_student_status(self, request, pk=None):
        submission_id = request.data.get('submission_id')
        new_status = request.data.get('status')
        
        try:
            sub = HomeworkSubmission.objects.get(
                    id=submission_id,
                    homework_id=pk
                )
            serializer = HomeworkSubmissionUpdateSerializer(sub, data={'status': new_status}, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response({"status": "updated", "new_status": new_status})
        except (HomeworkSubmission.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Topshiriq topilmadi"}, status=404)

    @action(detail=False, methods=['get'])
    def weekly_summary(self, request):
        user = request.user
        branch_id = request.query_params.get('branch_id')
        
        if user.role == 'admin':
            if user.branch:
                branch_id = user.branch.id
            else:
                return Response([])
                
        if not branch_id:
            return Response({"error": "branch_id parameter is required"}, status=400)
            
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Count, Q
        
        seven_days_ago = timezone.now() - timedelta(days=7)
        
        queryset = Homework.objects.filter(
            group__branch_id=branch_id,
            created_at__gte=seven_days_ago
        ).select_related('group', 'mentor').annotate(
            total_submissions=Count('submissions'),
            full_submissions=Count('submissions', filter=Q(submissions__status='full')),
            half_submissions=Count('submissions', filter=Q(submissions__status='half')),
            not_submitted_submissions=Count('submissions', filter=Q(submissions__status='not_submitted')),
        ).order_by('-created_at')
        
        # Pagination logikasini qo'llaymiz
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 10
        
        page = paginator.paginate_queryset(queryset, request)
        
        data = []
        target_set = page if page is not None else queryset
        
        for hw in target_set:
            data.append({
                "id": hw.id,
                "title": hw.title,
                "group_name": hw.group.name if hw.group else "Nomalum",
                "group_id": hw.group.id if hw.group else None,
                "mentor_name": hw.mentor.get_full_name() if hw.mentor and hasattr(hw.mentor, 'get_full_name') else (hw.mentor.username if hw.mentor else "Tizim"),
                "created_at": hw.created_at.strftime('%Y-%m-%d'),
                "stats": {
                    "total": hw.total_submissions,
                    "full": hw.full_submissions,
                    "half": hw.half_submissions,
                    "not_submitted": hw.not_submitted_submissions,
                }
            })
            
        if page is not None:
            return paginator.get_paginated_response(data)
            
        return Response(data)

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

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Count, Q

class HomeworkViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, HasModulePermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    module_name = 'homework'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['group'] 

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Homework.objects.none()
        user = self.request.user
        group_id = self.request.query_params.get('group_id') or self.request.query_params.get('group')
        
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

        if self.action == 'list':
            queryset = queryset.annotate(
                total_submissions=Count('submissions', distinct=True),
                completed_submissions=Count('submissions', filter=Q(submissions__status='full'), distinct=True)
            )
        elif self.action == 'retrieve':
            queryset = queryset.prefetch_related('submissions__student')

        return queryset.select_related('group', 'mentor').distinct()

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
            sub = HomeworkSubmission.objects.select_related('homework__group', 'student').get(
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

    @action(detail=False, methods=['get'], url_path='activity-stats')
    def activity_stats(self, request):
        """O'qituvchining dars o'tish, uyga vazifa berish va ularni tekshirish statistikasi (Zero N+1)"""
        user = request.user
        mentor_id = request.query_params.get('mentor_id')
        branch_id = request.query_params.get('branch_id')

        # 1. Mentor aniqlanadi
        if user.role == 'mentor':
            target_mentor = user
        elif mentor_id and user.role in ['admin', 'super_admin']:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            target_mentor = get_object_or_404(User, id=mentor_id)
        else:
            target_mentor = user

        # 2. Mentorning guruhlarini olish (N+1 muammosini oldini olish uchun select_related)
        groups_query = models.Q(mentor=target_mentor) | models.Q(additional_mentors__mentor=target_mentor)
        if branch_id:
            groups_query &= models.Q(branch_id=branch_id)
        elif user.role == 'admin' and getattr(user, 'branch_id', None):
            groups_query &= models.Q(branch_id=user.branch_id)

        groups = Group.objects.filter(groups_query, is_archived=False).select_related('branch').distinct()
        group_ids = list(groups.values_list('id', flat=True))

        if not group_ids:
            return Response({
                "mentor": {
                    "id": target_mentor.id,
                    "name": target_mentor.get_full_name() or target_mentor.username,
                },
                "summary": {
                    "total_homeworks": 0,
                    "total_submissions": 0,
                    "full_submissions": 0,
                    "half_submissions": 0,
                    "not_submitted": 0,
                    "checked_submissions": 0,
                    "check_rate": 0.0,
                    "full_rate": 0.0,
                    "total_groups": 0,
                    "total_students": 0,
                },
                "groups_breakdown": [],
                "timeline": [],
                "attendance_summary": {
                    "total_records": 0,
                    "present_records": 0,
                    "attendance_rate": 0.0,
                    "total_days": 0,
                }
            })

        # 3. Mentorning ushbu guruhlardagi vazifalari
        from django.db.models import Count, Q
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models.functions import TruncDate

        hw_qs = Homework.objects.filter(group_id__in=group_ids).filter(
            models.Q(mentor=target_mentor) | models.Q(mentor__isnull=True)
        )

        total_homeworks = hw_qs.count()

        # 4. Yagona agregatsiya (Single Query - Zero N+1)
        sub_stats = HomeworkSubmission.objects.filter(homework__in=hw_qs).aggregate(
            total=Count('id'),
            full=Count('id', filter=Q(status=HomeworkSubmission.FULL)),
            half=Count('id', filter=Q(status=HomeworkSubmission.HALF)),
            not_submitted=Count('id', filter=Q(status=HomeworkSubmission.NOT_SUBMITTED)),
        )

        total_subs = sub_stats['total'] or 0
        full_subs = sub_stats['full'] or 0
        half_subs = sub_stats['half'] or 0
        not_subs = sub_stats['not_submitted'] or 0
        checked_subs = full_subs + half_subs
        check_rate = round((checked_subs / total_subs * 100), 1) if total_subs > 0 else 0.0
        full_rate = round((full_subs / total_subs * 100), 1) if total_subs > 0 else 0.0

        # 5. Guruhlar kesimida tahlil (Optimallashtirilgan 2 ta so'rov)
        from groups.models import GroupEnrollment
        enrollments_count = dict(
            GroupEnrollment.objects.filter(
                group_id__in=group_ids,
                is_active=True,
                student__is_archived=False
            ).values('group_id').annotate(c=Count('id')).values_list('group_id', 'c')
        )

        group_hw_counts = dict(
            hw_qs.values('group_id').annotate(c=Count('id')).values_list('group_id', 'c')
        )

        groups_subs_agg = HomeworkSubmission.objects.filter(
            homework__in=hw_qs
        ).values('homework__group_id').annotate(
            total=Count('id'),
            full=Count('id', filter=Q(status=HomeworkSubmission.FULL)),
            half=Count('id', filter=Q(status=HomeworkSubmission.HALF)),
            not_submitted=Count('id', filter=Q(status=HomeworkSubmission.NOT_SUBMITTED)),
        )
        group_subs_map = {item['homework__group_id']: item for item in groups_subs_agg}

        total_students = sum(enrollments_count.values())

        groups_breakdown = []
        for g in groups:
            g_subs = group_subs_map.get(g.id, {'total': 0, 'full': 0, 'half': 0, 'not_submitted': 0})
            g_total_subs = g_subs['total'] or 0
            g_checked = (g_subs['full'] or 0) + (g_subs['half'] or 0)
            g_rate = round((g_checked / g_total_subs * 100), 1) if g_total_subs > 0 else 0.0

            groups_breakdown.append({
                'id': g.id,
                'name': g.name,
                'subject': g.subject or 'Kurs',
                'branch_name': g.branch.name if g.branch else '',
                'student_count': enrollments_count.get(g.id, 0),
                'homework_count': group_hw_counts.get(g.id, 0),
                'total_submissions': g_total_subs,
                'full_submissions': g_subs['full'] or 0,
                'half_submissions': g_subs['half'] or 0,
                'not_submitted': g_subs['not_submitted'] or 0,
                'checked_rate': g_rate,
            })

        # 6. Vaqt bo'yicha dinamika (so'nggi 30 kunlik trend)
        days_30_ago = timezone.now() - timedelta(days=30)

        hw_by_date = dict(
            hw_qs.filter(created_at__gte=days_30_ago)
            .annotate(d=TruncDate('created_at'))
            .values('d')
            .annotate(c=Count('id'))
            .values_list('d', 'c')
        )

        subs_by_date = HomeworkSubmission.objects.filter(
            homework__in=hw_qs,
            homework__created_at__gte=days_30_ago
        ).annotate(
            d=TruncDate('homework__created_at')
        ).values('d').annotate(
            total=Count('id'),
            full=Count('id', filter=Q(status=HomeworkSubmission.FULL)),
            half=Count('id', filter=Q(status=HomeworkSubmission.HALF)),
            not_submitted=Count('id', filter=Q(status=HomeworkSubmission.NOT_SUBMITTED)),
        )
        subs_date_map = {item['d']: item for item in subs_by_date}

        timeline = []
        curr = days_30_ago.date()
        today = timezone.localdate()
        while curr <= today:
            c_str = curr.strftime('%d.%m')
            s_item = subs_date_map.get(curr, {'total': 0, 'full': 0, 'half': 0, 'not_submitted': 0})
            hw_cnt = hw_by_date.get(curr, 0)
            timeline.append({
                'date': curr.strftime('%Y-%m-%d'),
                'label': c_str,
                'homeworks_created': hw_cnt,
                'full': s_item['full'] or 0,
                'half': s_item['half'] or 0,
                'not_submitted': s_item['not_submitted'] or 0,
                'total': s_item['total'] or 0,
            })
            curr += timedelta(days=1)

        # 7. Davomat ko'rsatkichi (so'nggi 30 kunlik darslar)
        from homework_attends.models import Attendance
        att_stats = Attendance.objects.filter(
            group_id__in=group_ids,
            date__gte=days_30_ago.date()
        ).aggregate(
            total_att=Count('id'),
            present_att=Count('id', filter=Q(is_present=True)),
            dates_count=Count('date', distinct=True)
        )
        total_att = att_stats['total_att'] or 0
        present_att = att_stats['present_att'] or 0
        att_rate = round((present_att / total_att * 100), 1) if total_att > 0 else 0.0

        return Response({
            "mentor": {
                "id": target_mentor.id,
                "name": target_mentor.get_full_name() or target_mentor.username,
            },
            "summary": {
                "total_homeworks": total_homeworks,
                "total_submissions": total_subs,
                "full_submissions": full_subs,
                "half_submissions": half_subs,
                "not_submitted": not_subs,
                "checked_submissions": checked_subs,
                "check_rate": check_rate,
                "full_rate": full_rate,
                "total_groups": len(groups),
                "total_students": total_students,
            },
            "groups_breakdown": groups_breakdown,
            "timeline": timeline,
            "attendance_summary": {
                "total_records": total_att,
                "present_records": present_att,
                "attendance_rate": att_rate,
                "total_days": att_stats['dates_count'] or 0,
            }
        })


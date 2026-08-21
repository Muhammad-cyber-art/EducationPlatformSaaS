from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import models
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend

from homework_attends.models import MockTest, MockTestResult
from groups.models import Group
from homework_attends.serializers import (
    MockTestListSerializer, 
    MockTestDetailSerializer, 
    MockTestResultUpdateSerializer
)
from homework_attends.services import create_mock_test_with_results, archive_mock_test
from permissions.permissions import HasModulePermission

class MockTestViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'homework'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['group']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return MockTest.objects.none()
        user = self.request.user
        group_id = self.request.query_params.get('group_id')
        
        if user.role == 'super_admin':
            queryset = MockTest.objects.all()
        elif user.role == 'admin':
            queryset = MockTest.objects.filter(group__branch=user.branch)
        else:
            # Mentor access
            group_ids = list(Group.objects.filter(mentor=user).values_list('id', flat=True))
            group_ids += list(Group.objects.filter(additional_mentors__mentor=user).values_list('id', flat=True))
            queryset = MockTest.objects.filter(group_id__in=group_ids)

        if group_id:
            queryset = queryset.filter(group_id=group_id)

        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('results__student')

        return queryset.select_related('group').distinct()

    def get_serializer_class(self):
        if self.action == 'list':
            return MockTestListSerializer
        if self.action == 'retrieve':
            return MockTestDetailSerializer
        return MockTestListSerializer

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
        create_mock_test_with_results(serializer, group)

    def perform_destroy(self, instance):
        archive_mock_test(instance, self.request.user)
        instance.delete()

    @action(detail=True, methods=['patch'])
    def update_student_score(self, request, pk=None):
        result_id = request.data.get('result_id')
        score = request.data.get('score')
        
        try:
            result = MockTestResult.objects.get(
                id=result_id,
                test_id=pk
            )
            serializer = MockTestResultUpdateSerializer(result, data={'score': score}, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response({"status": "updated", "new_score": score})
        except (MockTestResult.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Natija topilmadi"}, status=404)

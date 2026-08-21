# apps/groups/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    GroupViewSet, StudentViewSet, MentorViewSet, StudentNestedView,
    GroupSimpleViewSet, AdminViewSet, MentorListViewSet, WaitingStudentViewSet
)

router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'nested_groups', GroupSimpleViewSet, basename='nested_group')
router.register(r'students', StudentViewSet, basename='student')
router.register(r'nested_mentors', MentorViewSet, basename='nested_mentor')
router.register(r'mentors', MentorListViewSet, basename='mentor')  # Yangi oddiy mentors list
router.register(r"nested_students",StudentNestedView,basename='nested_student')
router.register(r'admins', AdminViewSet, basename='admin')
router.register(r'waiting-students', WaitingStudentViewSet, basename='waiting-student')

urlpatterns = [
    path('', include(router.urls)),
    # This gives:
]

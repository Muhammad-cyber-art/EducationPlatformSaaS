from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ArchivedStudentViewSet, ArchivedStaffViewSet, ArchivedGroupViewSet, 
    PaymentArchiveViewSet, ArchivedHomeworkViewSet, ArchivedLidViewSet
)

router = DefaultRouter()
router.register(r'students', ArchivedStudentViewSet, basename='archived-students')
router.register(r'staff', ArchivedStaffViewSet, basename='archived-staff')
router.register(r'groups', ArchivedGroupViewSet, basename='archived-groups')
router.register(r'lids', ArchivedLidViewSet, basename='archived-lids')
router.register(r'payment-archives', PaymentArchiveViewSet, basename='payment-archive')
router.register(r'homework-storage', ArchivedHomeworkViewSet, basename='archived-homework')

urlpatterns = [
    path('', include(router.urls)),
]

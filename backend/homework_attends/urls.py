from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HomeworkViewSet ,AttendanceViewSet, MockTestViewSet

router = DefaultRouter()
router.register('homeworks', HomeworkViewSet, basename='homework')
router.register('attendances', AttendanceViewSet, basename='attendance')
router.register('mock-tests', MockTestViewSet, basename='mock-test')

urlpatterns = [
    # Manual paths for quick access
    path('monthly-report/', AttendanceViewSet.as_view({'get': 'monthly_report'}), name='attendance-monthly-report'),
    
    # Router paths
    path('', include(router.urls)),
]
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StaffPermissionViewSet

router = DefaultRouter()
# /permissions/staff/" ID orqali kirish imkonini beradi
router.register(r'staff', StaffPermissionViewSet, basename='staff-permission')

urlpatterns = [
    path('', include(router.urls)),
]
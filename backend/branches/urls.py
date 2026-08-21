from rest_framework.routers import DefaultRouter
from branches.views import BranchViewSet
from django.urls import path, include

router = DefaultRouter()
router.register(r'branches', BranchViewSet, basename='branches')

urlpatterns = [
    path('',include(router.urls))
]

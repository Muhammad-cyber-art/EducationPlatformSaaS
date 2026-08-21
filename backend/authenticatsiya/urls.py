from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import RegisterViewSet, LoginView, UsersListView, CurrentUserView,BranchAccessViewSet

router = DefaultRouter()
router.register(r'users', RegisterViewSet, basename='user')
router.register(r'branch-access', BranchAccessViewSet, basename='branch-access')

urlpatterns = [
    path('register/', include(router.urls)),                  # POST /users/ - yaratish, GET - ro'yxat
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('users/', UsersListView.as_view(), name='users-list'),  # Umumiy ro'yxat (filtrlash mumkin)
    path('user/me/', CurrentUserView.as_view(), name='current-user'),
]
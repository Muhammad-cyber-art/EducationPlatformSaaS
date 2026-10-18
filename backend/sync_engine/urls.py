from django.urls import path
from .views import SyncEngineAPIView

urlpatterns = [
    path('', SyncEngineAPIView.as_view(), name='sync-engine'),
]

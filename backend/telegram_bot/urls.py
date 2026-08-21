from django.urls import path
from .views import BroadcastMessageView, BotStatisticsView, ExportUnregisteredStudentsView

urlpatterns = [
    path('broadcast/', BroadcastMessageView.as_view(), name='broadcast-message'),
    path('statistics/', BotStatisticsView.as_view(), name='bot-statistics'),
    path('export-unregistered-students/', ExportUnregisteredStudentsView.as_view(), name='export-unregistered-students'),
]

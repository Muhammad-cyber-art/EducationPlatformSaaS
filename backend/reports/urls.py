from django.urls import path
from .views import DailyReportExportView, MonthlyFinanceExportView, CheckPendingNotificationsView

urlpatterns = [
    path('', DailyReportExportView.as_view(), name='daily_attendance_export'),
    path('monthly-finance/', MonthlyFinanceExportView.as_view(), name='monthly_finance_export'),
    path('check-pending-notifications/', CheckPendingNotificationsView.as_view(), name='check_pending_notifications'),
]
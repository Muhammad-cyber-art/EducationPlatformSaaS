from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BranchFinanceDetailView, StudentPaymentViewSet, EmployeePaymentViewSet,
    StaffProfileViewSet, FinanceDashboardView, trigger_monthly_payments,
    FinanceTransactionViewSet, EmployeeAdvanceViewSet, AbsentTodayStudentsView,
    payment_statistics_view, MonthlyBranchTrendsView, AdminExpenseViewSet, MentorGroupSalaryConfigViewSet,
    SpecialStudentsDashboardAPIView, generate_single_student_payment
)

router = DefaultRouter()
router.register(r'student-payments', StudentPaymentViewSet, basename='student-payment')
router.register(r'employee-payments', EmployeePaymentViewSet, basename='employee-payment')
router.register(r'staff-profiles', StaffProfileViewSet, basename='staff-profile')
router.register(r'transactions', FinanceTransactionViewSet, basename='finance-transaction')
router.register(r'employee-advances', EmployeeAdvanceViewSet, basename='employee-advance')
router.register(r'admin-expenses', AdminExpenseViewSet, basename='admin-expense')
router.register(r'mentor-group-salary-configs', MentorGroupSalaryConfigViewSet, basename='mentor-group-salary-config')
urlpatterns = [
    path('', include(router.urls)),
    path('statistics/', FinanceDashboardView.as_view(), name='finance-stats'),
    path('generate/',trigger_monthly_payments, name='trigger-monthly-payments'),
    path('generate-student-payment/', generate_single_student_payment, name='generate-single-student-payment'),
    path('statistics/branch-finance/<int:branch_id>/', BranchFinanceDetailView.as_view(), name='branch-finance-detail'),
    path('statistics/monthly-branch-trends/', MonthlyBranchTrendsView.as_view(), name='monthly-branch-trends'),
    path('statistics/absent-students/<int:branch_id>/', AbsentTodayStudentsView.as_view(), name='absent-students-list'),
    path('payment-statistics/', payment_statistics_view, name='payment-statistics'),
    path('statistics/special-students-dashboard/<int:branch_id>/', SpecialStudentsDashboardAPIView.as_view(), name='special-students-dashboard'),
]
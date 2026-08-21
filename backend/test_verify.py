from rest_framework.test import APIRequestFactory, force_authenticate
from finance.views import StudentPaymentViewSet
from django.contrib.auth import get_user_model
from finance.models import FinanceTransaction

User = get_user_model()
user = User.objects.filter(role='super_admin').first()
factory = APIRequestFactory()
request = factory.post('/fake-url/')
force_authenticate(request, user=user)

view = StudentPaymentViewSet.as_view({'post': 'verify'})
# Get a deleted student's transaction
t = FinanceTransaction.objects.filter(student__isnull=True, is_verified=False).order_by('-id').first()
if t:
    parts = t.related_id.split('-')
    pk = parts[1]
    print(f"Testing verify for pk={pk} (related_id={t.related_id})")
    response = view(request, pk=pk)
    print(f"Status: {response.status_code}")
    print(f"Data: {response.data}")
    # Verify DB update
    t.refresh_from_db()
    print(f"Transaction is_verified in DB: {t.is_verified}")
else:
    print("No unverified transactions found for deleted students.")

from finance.models import FinanceTransaction
from finance.serializers import FinanceTransactionSerializer

txs = FinanceTransaction.objects.filter(student__isnull=True).order_by('-id')
for t in txs[:5]:
    print(f'Tx: {t.id} - {t.student_name} - Method in model: {t.payment_method}')
    serializer = FinanceTransactionSerializer(t)
    print(f'Serializer output: {serializer.data.get("payment_details")}')

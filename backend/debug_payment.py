from finance.models import FinanceTransaction, Payment

txs = FinanceTransaction.objects.filter(student__isnull=True, category='student_fee', related_id__startswith='STP-')
print(f'Found {txs.count()} transactions')

for t in txs:
    pid_str = t.related_id.split('-')[1]
    if pid_str.isdigit():
        pid = int(pid_str)
        p = Payment.objects.filter(id=pid).first()
        print(f'Tx: {t.id}, Payment {pid} exists: {p is not None}')
    else:
        print(f'Tx: {t.id}, Invalid related_id: {t.related_id}')

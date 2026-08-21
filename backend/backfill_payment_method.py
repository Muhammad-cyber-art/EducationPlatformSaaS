from finance.models import FinanceTransaction
from archivebase.models import ArchivedStudent

txs = FinanceTransaction.objects.filter(student__isnull=True, category='student_fee', related_id__startswith='STP-')
print(f'Backfilling {txs.count()} orphaned transactions...')
count = 0
for t in txs:
    pid_str = t.related_id.split('-')[1]
    if pid_str.isdigit():
        pid = int(pid_str)
        found = False
        for a in ArchivedStudent.objects.all():
            for p in a.metadata.get('payments', []):
                if p.get('id') == pid:
                    t.payment_method = p.get('payment_method')
                    t.save(update_fields=['payment_method'])
                    found = True
                    count += 1
                    break
            if found: break

print(f'Successfully backfilled {count} transactions from ArchivedStudent.')

# Backfill for existing payments that were not deleted
txs_valid = FinanceTransaction.objects.filter(student__isnull=False, category='student_fee', payment_method__isnull=True, related_id__startswith='STP-')
print(f'Backfilling {txs_valid.count()} valid transactions...')
from finance.models import Payment
count2 = 0
for t in txs_valid:
    pid_str = t.related_id.split('-')[1]
    if pid_str.isdigit():
        pid = int(pid_str)
        p = Payment.objects.filter(id=pid).first()
        if p:
            t.payment_method = p.payment_method
            t.save(update_fields=['payment_method'])
            count2 += 1
print(f'Successfully backfilled {count2} valid transactions from Payment.')

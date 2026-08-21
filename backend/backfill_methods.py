from finance.models import FinanceTransaction
from archivebase.models import ArchivedStudent

txs = FinanceTransaction.objects.filter(payment_method__isnull=True, related_id__startswith='STP-')
count = 0
for tx in txs:
    parts = tx.related_id.split('-')
    if len(parts) >= 2:
        payment_id = int(parts[1])
        # Find in ArchivedStudent
        archives = ArchivedStudent.objects.all()
        found = False
        for a in archives:
            history = a.metadata.get('payments', []) if a.metadata else []
            for p in history:
                if p.get('id') == payment_id:
                    method = p.get('payment_method', 'cash')
                    tx.payment_method = method
                    tx.save(update_fields=['payment_method'])
                    found = True
                    count += 1
                    print(f"Updated Tx {tx.id} with method {method}")
                    break
            if found:
                break
        if not found:
            # default to cash
            tx.payment_method = 'cash'
            tx.save(update_fields=['payment_method'])
            count += 1
            print(f"Updated Tx {tx.id} with default method cash")

print(f"Updated {count} transactions.")

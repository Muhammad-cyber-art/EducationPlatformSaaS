from finance.models import FinanceTransaction
from finance.serializers import FinanceTransactionSerializer

t = FinanceTransaction.objects.get(id=11)
serializer = FinanceTransactionSerializer(t)

print("Starting manual trace:")
obj = t
print(f"Category: {obj.category}")
print(f"Related ID: {obj.related_id}")
if obj.category == 'student_fee' and obj.related_id and obj.related_id.startswith('STP-'):
    parts = obj.related_id.split('-')
    print(f"Parts length: {len(parts)}")
    if len(parts) >= 2:
        try:
            payment_id = int(parts[1])
            print(f"Payment ID: {payment_id}")
            from finance.models import Payment
            payment = Payment.objects.filter(id=payment_id).first()
            print(f"Payment found: {payment is not None}")
            if payment:
                pass
            else:
                print("Executing fallback block")
                res = {
                    'original_payment_id': payment_id,
                    'is_verified': obj.is_verified,
                    'receipt_image': None,
                    'month': obj.date.strftime('%Y-%m') if obj.date else None,
                    'payment_method': obj.payment_method,
                    'payment_method_display': dict(Payment.PAYMENT_METHODS).get(obj.payment_method, "Noma'lum") if obj.payment_method else "Noma'lum",
                    'refund_amount': 0,
                    'refund_ignored': False,
                    'is_partial': False,
                    'is_receiptless': False,
                    'group_name': obj.group_name
                }
                print(f"Result from fallback: {res}")
        except Exception as e:
            print(f"Exception: {e}")

print("Now calling get_payment_details directly:")
print(serializer.get_payment_details(t))

print("Now calling serializer.data:")
print(serializer.data.get("payment_details"))

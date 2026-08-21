from finance.models import FinanceTransaction, Payment

obj = FinanceTransaction.objects.filter(student__isnull=True).order_by('-id').first()

print(f"obj.category: {obj.category}")
print(f"obj.related_id: {obj.related_id}")
if obj.category == 'student_fee' and obj.related_id and obj.related_id.startswith('STP-'):
    parts = obj.related_id.split('-')
    print(f"parts: {parts}")
    if len(parts) >= 2:
        try:
            payment_id = int(parts[1])
            print(f"payment_id: {payment_id}")
            payment = Payment.objects.filter(id=payment_id).first()
            print(f"payment object: {payment}")
            if payment:
                print("Payment found")
            else:
                print("Payment NOT found, executing fallback")
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
                print(f"res: {res}")
        except Exception as e:
            print(f"Exception: {e}")
            import traceback
            traceback.print_exc()
else:
    print("Conditions not met")

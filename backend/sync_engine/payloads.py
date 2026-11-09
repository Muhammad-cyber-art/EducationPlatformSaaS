from decimal import Decimal
from rest_framework import serializers
from homework_attends.models import HomeworkSubmission


class AttendanceItem(serializers.Serializer):
    student_id = serializers.IntegerField(min_value=1)
    is_present = serializers.BooleanField()


class AttendancePayload(serializers.Serializer):
    group_id = serializers.IntegerField(min_value=1)
    date = serializers.DateField()
    attendances = AttendanceItem(many=True, allow_empty=False, max_length=500)

    def validate_attendances(self, items):
        ids = [item['student_id'] for item in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('O‘quvchi IDlari takrorlanmasligi kerak.')
        return items


class PaymentPayload(serializers.Serializer):
    payment_id = serializers.IntegerField(min_value=1, required=False)
    student_id = serializers.IntegerField(min_value=1, required=False)
    group_id = serializers.IntegerField(min_value=1, required=False)
    month = serializers.DateField(required=False, input_formats=['%Y-%m-%d', '%Y-%m'])
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    payment_method = serializers.ChoiceField(choices=['cash', 'click', 'payme', 'other'], required=False)
    method = serializers.ChoiceField(choices=['cash', 'click', 'payme', 'other'], required=False)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    pay_full_month = serializers.BooleanField(required=False)
    ignore_refund = serializers.BooleanField(required=False)
    is_partial_payment = serializers.BooleanField(required=False)
    is_custom_amount = serializers.BooleanField(required=False)
    is_full_amount = serializers.BooleanField(required=False)
    is_receiptless = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs.get('payment_id') and not (attrs.get('student_id') and attrs.get('group_id')):
            raise serializers.ValidationError('payment_id yoki student_id va group_id majburiy.')
        return attrs


class ExpensePayload(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    description = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    date = serializers.DateField(required=False)
    branch = serializers.IntegerField(min_value=1)


class SubmissionPayload(serializers.Serializer):
    submission_id = serializers.IntegerField(min_value=1)
    status = serializers.ChoiceField(choices=HomeworkSubmission.STATUS_CHOICES)


class LeadPayload(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    status = serializers.ChoiceField(choices=['new', 'in_progress', 'qualified', 'rejected', 'converted'], required=False)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=10000)
    updated_at = serializers.DateTimeField(required=False)
    is_deleted = serializers.BooleanField(required=False)

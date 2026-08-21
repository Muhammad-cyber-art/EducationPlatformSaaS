from django.core.management.base import BaseCommand
from django.db.models import Sum
from groups.models import Student
from finance.models import FinanceTransaction, StudentFinanceProfile

class Command(BaseCommand):
    help = "Barcha o'quvchilar uchun StudentFinanceProfile (Wallet) larni yaratish va arxiv tranzaksiyalar bo'yicha to'ldirish"

    def handle(self, *args, **kwargs):
        students = Student.objects.all()
        created_count = 0
        updated_count = 0
        
        self.stdout.write("Jarayon boshlandi... O'quvchilar soni: {}".format(students.count()))
        
        for student in students:
            profile, created = StudentFinanceProfile.objects.get_or_create(student=student)
            if created:
                created_count += 1
                
            paid_agg = FinanceTransaction.objects.filter(
                student=student, 
                transaction_type='income',
                category='student_fee'
            ).aggregate(total=Sum('amount'))
            
            refund_agg = FinanceTransaction.objects.filter(
                student=student, 
                transaction_type='expense',
                category='refund'
            ).aggregate(total=Sum('amount'))
            
            profile.total_paid_all_time = paid_agg['total'] or 0
            profile.total_refunded = refund_agg['total'] or 0
            
            last_payment = FinanceTransaction.objects.filter(
                student=student,
                transaction_type='income',
                category='student_fee'
            ).order_by('-date').first()
            
            if last_payment:
                profile.last_payment_date = last_payment.date
                
            profile.save()
            updated_count += 1
            
        self.stdout.write(self.style.SUCCESS(
            f"Muvaffaqiyatli yakunlandi! Yangi yaratildi: {created_count}, Yangilandi: {updated_count}"
        ))

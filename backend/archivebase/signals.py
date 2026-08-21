from django.db.models.signals import pre_delete
from django.dispatch import receiver
from finance.models import StaffProfile, EmployeePayment
from .models import PaymentArchive

@receiver(pre_delete, sender=StaffProfile)
def archive_and_delete_all_payments(sender, instance, **kwargs):
    """
    SuperAdmin xodim profilini o'chirganda:
    1. Kvitansiyalarni arxivga nusxalaydi.
    2. Kvitansiyalarni asosiy jadvaldan (EmployeePayments) o'chirib tashlaydi.
    """
    # 1. Xodimga tegishli barcha kvitansiyalarni topamiz
    # (employee = instance.user orqali bog'langan deb hisoblaymiz)
    payment_queryset = EmployeePayment.objects.filter(employee=instance.user)
    
    archive_list = []
    
    for payment in payment_queryset:
        # Har bir kvitansiya ma'lumotini arxiv uchun tayyorlaymiz
        archive_list.append(PaymentArchive(
            user_id=instance.user.id,
            full_name=f"{instance.user.first_name} {instance.user.last_name}",
            role=instance.user.role,
            branch_name=instance.user.branch.name if instance.user.branch else "Noma'lum",
            monthly_salary=instance.fixed_salary,
            total_amount=payment.total_amount,
            karta=instance.karta,
            month=payment.month,
            is_paid=payment.is_paid,
            paid_at=payment.paid_at
        ))
    
    # 2. Arxivga saqlash (bulk_create - bir vaqtning o'zida hammasini saqlaydi)
    if archive_list:
        PaymentArchive.objects.bulk_create(archive_list)
        
    # 3. ENG MUHIM QISMI: Asosiy jadvaldan o'chirish
    # Arxivlangandan keyin kvitansiyalarni butunlay o'chiramiz
    payment_queryset.delete() 

    # Natijada: Profil o'chadi -> Kvitansiyalar arxivga o'tadi -> 
    # -> Kvitansiyalar asosiy ro'yxatdan (/employee-payments/) yo'qoladi.
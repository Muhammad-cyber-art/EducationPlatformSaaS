from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db.models import Q
from groups.models import Group, Student
from .utils import send_telegram_message_async, get_student_telegram_ids
from django.db.models import Q

class BroadcastMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        group_id = request.data.get('group_id')
        branch_id = request.data.get('branch_id')
        student_id = request.data.get('student_id')
        send_to_all_branches = request.data.get('send_to_all_branches', False)
        message = request.data.get('message')
        group = None

        if not message:
            return Response({"error": "Xabar matni kiritilmadi"}, status=status.HTTP_400_BAD_REQUEST)

        # Base Queryset for students
        # Broadcast xabarlari uchun arxivlangan/o'chirilgan o'quvchilarga ham boradi (lidlar sifatida)
        # Faqat is_active=False bo'lganlarni chiqarib tashlaymiz (soft delete)
        students_qs = Student.objects.filter(is_active=True)

        # 1. Global (Barcha filiallar) - Faqat Super Admin uchun
        if send_to_all_branches:
            if user.role != 'super_admin':
                return Response({"error": "Barcha filialarga xabar yuborish faqat Super Admin uchun mumkin"}, status=status.HTTP_403_FORBIDDEN)
            # No filtering needed for students_qs

        # 2. Guruh bo'yicha
        elif group_id:
            group = get_object_or_404(Group, id=group_id)
            # Permission check...
            has_permission = False
            if user.role == 'super_admin': has_permission = True
            elif user.role == 'admin':
                allowed_branches = [user.branch.id] if user.branch else []
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
                if group.branch_id in allowed_branches: has_permission = True
            elif user.role == 'mentor':
                if group.mentor == user or group.additional_mentors.filter(mentor=user).exists():
                    has_permission = True
            
            if not has_permission:
                return Response({"error": "Siz ushbu guruhga xabar yuborish huquqiga ega emassiz"}, status=status.HTTP_403_FORBIDDEN)
            
            # Broadcast uchun: Guruhda hozir aktiv enrollment bo'lgan barcha o'quvchilarga boradi
            # (arxivlangan o'quvchilarga ham, chunki ular lidlar sifatida qoladi)
            # Lekin guruhdan chiqqan o'quvchilarga (enrollments__is_active=False) bormasligi kerak
            students_qs = students_qs.filter(
                groups=group,
                enrollments__group=group,
                enrollments__is_active=True,
            ).distinct()

        # 3. Filial bo'yicha
        elif branch_id:
            # Permission check
            if user.role != 'super_admin':
                # Admin faqat o'ziga ruxsat berilgan filialga yubora oladi
                allowed_branches = [user.branch.id] if user.branch else []
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
                if int(branch_id) not in allowed_branches:
                    return Response({"error": "Siz ushbu filialga xabar yubora olmaysiz"}, status=status.HTTP_403_FORBIDDEN)
            
            students_qs = students_qs.filter(branch_id=branch_id)

        # 4. Yagona o'quvchi bo'yicha
        elif student_id:
            students_qs = students_qs.filter(id=student_id)
            if not students_qs.exists():
                return Response({"error": "O'quvchi topilmadi o'quvchi ID xato yoki ruxsat yo'q"}, status=status.HTTP_404_NOT_FOUND)

        # 5. Agar hech narsa berilmasa va Super Admin bo'lsa (Eski logika muvofiqligi)
        elif user.role == 'super_admin':
            pass # Barcha o'quvchilarga boradi (Global)
        
        else:
            return Response({"error": "Maqsadli guruh, filial yoki o'quvchi ko'rsatilmadi"}, status=status.HTTP_400_BAD_REQUEST)

        # Xabarlarni yuborish uchun ID-larni yig'amiz
        target_chat_ids = set()
        for student in students_qs:
            chat_ids = get_student_telegram_ids(student)
            target_chat_ids.update(chat_ids)
        
        # Yakuniy xabar mazmuni
        final_message = message
        if group_id:
            group = Group.objects.filter(id=group_id).first()
            if group:
                final_message = f"<b>{group.name}</b>\n\n{message}"

        # Xabarlarni yuborish (Faqat Celery orqali)
        try:
            from .tasks import send_broadcast_message_task
            send_broadcast_message_task.delay(list(target_chat_ids), final_message)
        except Exception as e:
            # Celery/Redis ishlamayotgan bo'lsa xato qaytaramiz (Background thread ishlatish xavfli)
            return Response({"error": f"Xabarlarni yuborishda xatolik yuz berdi (Celery yoki Redis ishlamayapti): {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        sent_count = len(target_chat_ids)
        target_name = "Barcha o'quvchilar" if send_to_all_branches or (not group_id and not branch_id and not student_id) else (f"Tanlangan guruh: '{group.name}'" if group else "Tanlangan o'quvchi / filial")
        return Response({
            "status": "success", 
            "detail": f"Xabar {sent_count} ta unikal foydalanuvchiga yuborilmoqda ({target_name})."
        })

class BotStatisticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get('branch_id')
        group_id = request.query_params.get('group_id')
        
        # Broadcast statistikasi uchun ham arxivlangan o'quvchilarni sanash (lidlar sifatida)
        qs = Student.objects.filter(is_active=True)

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if group_id:
            group_obj = get_object_or_404(Group, id=group_id)
            # Broadcast statistikasi uchun ham arxivlangan o'quvchilarni sanash (lidlar sifatida)
            # Lekin faqat aktiv enrollment bo'lganlarni
            qs = group_obj.students.filter(
                enrollments__group=group_obj,
                enrollments__is_active=True,
                is_active=True,
            ).distinct()
            
        # O'quvchilarni sanash (telegram_id bo'sh bo'lmaganlar)
        students_bot = qs.exclude(Q(telegram_id__isnull=True) | Q(telegram_id='')).count()
        
        # Ota-onalarni sanash (parent_telegram_id bo'sh bo'lmaganlar)
        parents_bot = qs.exclude(Q(parent_telegram_id__isnull=True) | Q(parent_telegram_id='')).count()
        
        return Response({
            "students_bot_count": students_bot,
            "parents_bot_count": parents_bot,
            "total_bot_users": students_bot + parents_bot
        })


class ExportUnregisteredStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        branch_id = request.query_params.get('branch_id')
        group_id = request.query_params.get('group_id')
        
        # Permission check
        if user.role not in ['super_admin', 'admin']:
            return Response({"error": "Sizda bu huquqga ega emassiz"}, status=status.HTTP_403_FORBIDDEN)
            
        # Export uchun ham arxivlangan o'quvchilarni qo'shamiz (lidlar sifatida)
        qs = Student.objects.filter(is_active=True)
        
        # Filter by branch
        if user.role == 'admin':
            allowed_branches = [user.branch.id] if user.branch else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            qs = qs.filter(branch_id__in=allowed_branches)
            
        if branch_id:
            if user.role == 'admin':
                # Check permission for admin
                allowed_branches = [user.branch.id] if user.branch else []
                if hasattr(user, 'branch_accesses'):
                    allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
                if int(branch_id) not in allowed_branches:
                    return Response({"error": "Siz ushbu filialga ruxsat yo'q"}, status=status.HTTP_403_FORBIDDEN)
            qs = qs.filter(branch_id=branch_id)
            
        if group_id:
            group = get_object_or_404(Group, id=group_id)
            # Check if user has access
            has_permission = False
            if user.role == 'super_admin': has_permission = True
            elif user.role == 'admin':
                allowed_branches = [user.branch.id] if user.branch else []
                if hasattr(user, 'branch_accesses'):
                    allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
                if group.branch_id in allowed_branches: has_permission = True
            if not has_permission:
                return Response({"error": "Siz ushbu guruhga ruxsat yo'q"}, status=status.HTTP_403_FORBIDDEN)
            # Export uchun ham arxivlangan o'quvchilarni qo'shamiz (lidlar sifatida)
            # Lekin faqat aktiv enrollment bo'lganlarni
            qs = qs.filter(
                groups=group,
                enrollments__group=group,
                enrollments__is_active=True,
            ).distinct()
            
        # Filter for unregistered (no telegram_id and no parent_telegram_id
        unregistered = qs.filter(
            (Q(telegram_id__isnull=True) | Q(telegram_id='')) &
            (Q(parent_telegram_id__isnull=True) | Q(parent_telegram_id=''))
        )
        
        # Create Excel
        from openpyxl import Workbook
        from openpyxl.styles import Font
        from django.http import HttpResponse
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Ro'yxatdan o'tmaganlar"
        
        # Header row
        headers = ["ID", "Ism Familiya", "Telefon", "Guruh", "Filial"]
        ws.append(headers)
        
        # Style header
        for cell in ws[1]:
            cell.font = Font(bold=True)
            
        # Fill data
        for student in unregistered:
            # BUG FIX #3: Legacy student.group (FK) o'rniga M2M orqali aktiv guruhlarni olish.
            # student.group — eski, ishlatilmaydigan FK. Haqiqiy guruhlar student.groups (M2M) da.
            active_group_names = list(
                student.groups.filter(
                    enrollments__student=student,
                    enrollments__is_active=True,
                ).values_list('name', flat=True).distinct()
            )
            group_name = ", ".join(active_group_names) if active_group_names else "Guruhsiz"
            branch_name = student.branch.name if student.branch else "Nomalum"
            ws.append([
                student.id,
                student.full_name,
                student.phone,
                group_name,
                branch_name
            ])
        
        # Create response
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename=royxatdan_otmagan_oquvchilar.xlsx'
        wb.save(response)
        return response

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated,AllowAny
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse

import logging
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter
from datetime import timedelta

from homework_attends.models import Attendance
from groups.models import Group
from homework_attends.serializers import AttendanceSerializer, AttendanceEditSerializer
from homework_attends.services import (
    get_or_create_attendance_records, 
    generate_weekly_attendance_report, 
    bulk_confirm_attendance, 
    get_monthly_attendance_data,
    edit_past_attendance,
    get_last_3_lesson_dates
)
from permissions.permissions import HasModulePermission
from reports.models import ReportDownloadTrack
from datetime import date as date_type

logger = logging.getLogger(__name__)

class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    module_name = 'homework'
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        """Monthly report va student_monthly uchun autentifikatsiya majburiy"""
        if self.action in ['monthly_report', 'student_monthly']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
       group_id = self.request.query_params.get('group_id')
       date_str = self.request.query_params.get('date', str(timezone.localdate()))
       
       if not group_id:
           return Attendance.objects.none()
       
       try:
           requested_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
       except (ValueError, TypeError):
           requested_date = timezone.localdate()

       group = get_object_or_404(Group, id=group_id)
       # O'tgan oylar uchun: faqat mavjud yozuvlarni ko'rsatish (yangi yaratmaslik)
       today = timezone.localdate()
       is_past_month = requested_date.year < today.year or (requested_date.year == today.year and requested_date.month < today.month)
       return get_or_create_attendance_records(group, requested_date, view_only=is_past_month)

    @action(detail=False, methods=['get'])
    def weekly_report(self, request):
         group_id = request.query_params.get('group_id')
         group = get_object_or_404(Group, id=group_id)
         
         report = generate_weekly_attendance_report(group)
         return Response(report)
    
    def create(self, request, *args, **kwargs):
        attendance_id = request.data.get('id')
        is_present = request.data.get('is_present')
        student_id = request.data.get('student_id')
        date_str = request.data.get('date')

        # 1. Update existing record
        if attendance_id is not None:
            instance = get_object_or_404(Attendance, id=attendance_id)
            today = timezone.localdate()
            if instance.date != today:
                last_3_dates = get_last_3_lesson_dates(instance.group)
                
                # Grace period: Tungi 4 gacha kechagi kunni o'zgartirishga ruxsat
                is_early_morning = timezone.localtime().hour < 4
                is_yesterday = instance.date == (today - timedelta(days=1))
                if instance.date not in last_3_dates and not (is_early_morning and is_yesterday):
                    return Response({"detail": f"Faqat bugungi yoki oxirgi 3 ta o'tilgan dars davomatini tahrirlashingiz mumkin."}, status=status.HTTP_400_BAD_REQUEST)
            
            instance.is_present = is_present
            instance.marked_by = request.user
            instance.save()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # 2. Create new record
        if not (student_id and date_str):
             return Response({"detail": "Student ID va kun (date) majburiy"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            requested_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Sana formati noto'g'ri (YYYY-MM-DD)"}, status=status.HTTP_400_BAD_REQUEST)

        group = get_object_or_404(Group, id=group_id)
        
        # Ruxsat etilgan sanalar: Bugun, yoki oxirgi 3 ta dars
        today = timezone.localdate()
        if requested_date != today:
            last_3_dates = get_last_3_lesson_dates(group)
            
            is_early_morning = timezone.localtime().hour < 4
            is_yesterday = requested_date == (today - timedelta(days=1))
            if requested_date not in last_3_dates and not (is_early_morning and is_yesterday):
                return Response({"detail": f"Faqat bugungi yoki oxirgi 3 ta o'tilgan dars davomatini tahrirlashingiz mumkin."}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(group.students, id=student_id)

        # Duplicate check
        attendance, created = Attendance.objects.get_or_create(
            student=student, 
            group=group, 
            date=requested_date,
            defaults={
                'is_present': is_present,
                'marked_by': request.user
            }
        )
        if not created:
            attendance.is_present = is_present
            attendance.marked_by = request.user
            attendance.save()

        serializer = self.get_serializer(attendance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='confirm')
    def confirm_attendance(self, request):
        group_id = request.data.get('group_id')
        date_str = request.data.get('date')
        attendances_payload = request.data.get('attendances', [])

        if not group_id or not date_str:
            return Response({"detail": "group_id va date majburiy"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            requested_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Sana formati noto'g'ri (YYYY-MM-DD)"}, status=status.HTTP_400_BAD_REQUEST)

        group = get_object_or_404(Group, id=group_id)
        
        # Ruxsat etilgan sanalar: Bugun, yoki oxirgi 3 ta dars
        today = timezone.localdate()
        if requested_date != today:
            last_3_dates = get_last_3_lesson_dates(group)
            
            is_early_morning = timezone.localtime().hour < 4
            is_yesterday = requested_date == (today - timedelta(days=1))
            if requested_date not in last_3_dates and not (is_early_morning and is_yesterday):
                return Response({"detail": f"Faqat bugungi yoki oxirgi 3 ta o'tilgan dars davomatini tahrirlashingiz mumkin."}, status=status.HTTP_400_BAD_REQUEST)


        
        queryset = bulk_confirm_attendance(group, requested_date, attendances_payload, request.user)
        serializer = AttendanceSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _user_can_access_group(self, user, group):
        """Foydalanuvchi guruhga kirish huquqini tekshirish"""
        if user.role == 'super_admin':
            return True
        if user.role == 'admin':
            allowed = [user.branch_id] if user.branch_id else []
            if hasattr(user, 'branch_accesses'):
                allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return group.branch_id in allowed
        if user.role == 'mentor':
            return group.mentor == user or group.additional_mentors.filter(mentor=user).exists()
        return False

    @action(detail=False, methods=['get'], url_path='monthly-report')
    def monthly_report(self, request):
        group_id = request.query_params.get('group_id')
        if not group_id:
            return Response({"detail": "group_id majburiy"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            group = get_object_or_404(Group, id=group_id)
            
            # Foydalanuvchining guruhga kirish huquqini tekshirish
            if not self._user_can_access_group(request.user, group):
                logger.warning(
                    "User %s (role=%s) has no access to group %s (branch=%s)",
                    request.user, request.user.role, group.id, group.branch_id
                )
                return Response(
                    {"detail": "Sizda ushbu guruh davomatini ko'rish huquqi yo'q"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            today = timezone.localdate()
            
            try:
                month = int(request.query_params.get('month', today.month))
                year = int(request.query_params.get('year', today.year))
                # Oy va yil qiymatlarini tekshirish
                date_type(year, month, 1)
            except (ValueError, TypeError):
                month, year = today.month, today.year
                
            date_list, students, att_data = get_monthly_attendance_data(group, month, year)
        except Exception as e:
            logger.exception("Monthly report data olishda xatolik: group=%s, month=%s-%s", group_id, year, month)
            return Response(
                {"detail": f"Hisobot ma'lumotlarini olishda xatolik: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        export_mode = request.query_params.get('export', 'json')
        
        if export_mode == 'excel':
            wb = openpyxl.Workbook()
            ws = wb.active
            
            # openpyxl sheet title has strict rules: max 31 chars, no forbidden chars: \ / ? * : [ ]
            safe_sheet_name = f"Davomat_{group.name[:20]}"
            for char in r"\/?:*[]":
                safe_sheet_name = safe_sheet_name.replace(char, "")
            safe_sheet_name = safe_sheet_name.strip()[:30]
            if not safe_sheet_name:
                safe_sheet_name = "Davomat"
            ws.title = safe_sheet_name
            
            header_font = Font(bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            center_align = Alignment(horizontal='center', vertical='center')
            
            headers = ["№", "O'quvchi ismi-familiyasi", "Telefon", "Ota-ona telefon"] + [d.day for d in date_list]
            for col_num, header in enumerate(headers, 1):
                cell = ws.cell(row=2, column=col_num)
                cell.value = header

            ws.column_dimensions['A'].width = 5
            ws.column_dimensions['B'].width = 30
            ws.column_dimensions['C'].width = 15
            ws.column_dimensions['D'].width = 15
            for col_num in range(5, len(headers) + 1):
                ws.column_dimensions[get_column_letter(col_num)].width = 4
                
            header_row = ws[2]
            for cell in header_row:
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = center_align

            for row_num, student in enumerate(students, 3):
                ws.cell(row=row_num, column=1).value = row_num - 2
                ws.cell(row=row_num, column=2).value = student.full_name
                ws.cell(row=row_num, column=3).value = student.phone or "-"
                ws.cell(row=row_num, column=4).value = student.parent_phone or "-"
                
                joined_at = student.joined_at.date() if student.joined_at else None
                
                for col_idx, d in enumerate(date_list, 5):
                    cell = ws.cell(row=row_num, column=col_idx)
                    
                    att_record = att_data.get(student.id, {}).get(str(d))
                    
                    if att_record:
                        if not att_record.get('is_confirmed'):
                            cell.value = "!" # Davomat olinmagan (tasdiqlanmagan)
                            cell.font = Font(color="FF0000", bold=True)
                        elif att_record.get('is_present') is True:
                            cell.value = "+"
                            cell.font = Font(color="008000", bold=True)
                        else:
                            cell.value = "K" 
                            cell.font = Font(color="FF0000", bold=True)
                    elif joined_at and d < joined_at:
                        cell.value = "-"
                    else:
                        # Record yo'q bo'lsa va dars kuni bo'lsa (date_list dars kunlaridan iborat)
                        cell.value = "!"
                        cell.font = Font(color="FF0000", bold=True)

                    cell.alignment = center_align

            # Yuklab olish tarixini saqlash (xatolik bo'lsa ham report yuklanishi kerak)
            try:
                report_date = date_type(year, month, 1)
                ReportDownloadTrack.objects.get_or_create(
                    user=request.user,
                    report_type='attendance_monthly',
                    report_date=report_date
                )
            except Exception as e:
                logger.warning(
                    "ReportDownloadTrack saqlashda xatolik: user=%s, group=%s, month=%s-%s — %s",
                    request.user, group.id, year, month, e
                )

            from urllib.parse import quote
            # Format filename safely to avoid UnicodeEncodeError in Content-Disposition header
            raw_filename = f"davomat_{group.name}_{year}_{month}.xlsx"
            # Remove characters that can break the HTTP header or represent directory traversal
            safe_filename = raw_filename.replace('\n', '').replace('\r', '').replace('"', '_').replace('/', '_').replace('\\', '_')
            encoded_filename = quote(safe_filename)
            
            response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="{encoded_filename}"; filename*=utf-8\'\'{encoded_filename}'
            try:
                wb.save(response)
            except Exception as e:
                logger.exception("Excel faylni yaratishda xatolik: group=%s, month=%s-%s", group.id, year, month)
                return Response(
                    {"detail": f"Excel faylni yaratishda xatolik: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return response

        # JSON Response
        report_data = []
        for student in students:
            history = []
            joined_at = student.joined_at.date() if student.joined_at else None
            for d in date_list:
                date_str = str(d)
                att_record = att_data.get(student.id, {}).get(date_str)
                
                # BUG #6 FIX: 'att_status' nomini ishlatamiz — 'status' DRF moduli bilan to'qnashmaslik uchun
                if joined_at and d < joined_at:
                    att_status = "not_joined"
                elif att_record:
                    if not att_record.get('is_confirmed'):
                        att_status = "not_taken"
                    elif att_record.get('is_present'):
                        att_status = "present"
                    else:
                        att_status = "absent"
                else:
                    # Dars kuni, lekin rekord yo'q
                    if d < timezone.localdate():
                        att_status = "not_taken"
                    else:
                        att_status = "none"
                
                history.append({"date": date_str, "status": att_status})
            
            report_data.append({
                "student_id": student.id,
                "student_name": student.full_name,
                "attendance": history
            })

        return Response({
            "group_name": group.name,
            "period": f"{year}-{month:02d}",
            "data": report_data
        })

    @action(detail=True, methods=['patch'], url_path='edit-past', permission_classes=[IsAuthenticated])
    def edit_past(self, request, pk=None):
        """
        Oxirgi 3 ta o'tilgan darsdan birortasining davomatini tahrirlash.
        """
        attendance = self.get_object()
        serializer = AttendanceEditSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        # Admin huquqini tekshirish
        if request.user.role not in ['admin', 'super_admin']:
            return Response(
                {"detail": "Faqat administratorlar o'tgan davomatni tahrirlay oladi."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        try:
            from rest_framework.exceptions import ValidationError
            updated_attendance = edit_past_attendance(
                attendance_id=attendance.id,
                admin_user=request.user,
                new_status=serializer.validated_data['new_status'],
                reason=serializer.validated_data['reason']
            )
            return Response(
                AttendanceSerializer(updated_attendance).data, 
                status=status.HTTP_200_OK
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Davomat tahrirlashda xatolik: %s", str(e))
            return Response(
                {"detail": "Tizim xatoligi yuz berdi. Iltimos adminga murojaat qiling."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], url_path='student-monthly', permission_classes=[IsAuthenticated])
    def student_monthly(self, request):
        """
        O'quvchining 1 oylik davomatini GitHub-style heatmap uchun agregatsiya qilish.
        Faqat so'rov yuborilganda asinxron (lazy) olinadi.
        Moliya ma'lumotlariga mutlaqo daxl qilmaydi (Read-Only).
        """
        from groups.models import Student, GroupEnrollment
        from calendar import monthrange
        from datetime import date as date_type

        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({"detail": "student_id parametri majburiy"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student_id_int = int(student_id)
        except (ValueError, TypeError):
            return Response({"detail": "student_id butun son bo'lishi kerak"}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(Student, id=student_id_int)

        # Ruxsatlarni tekshirish (Access Control)
        user = request.user
        if user.role == 'admin':
            allowed_branches = [user.branch_id] if user.branch_id else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            student_branch = student.branch_id or (student.group.branch_id if student.group else None)
            if not student_branch:
                first_active_enrollment = student.enrollments.filter(is_active=True).select_related('group').first()
                if first_active_enrollment and first_active_enrollment.group:
                    student_branch = first_active_enrollment.group.branch_id

            if student_branch and student_branch not in allowed_branches:
                return Response({"detail": "Sizda ushbu o'quvchi ma'lumotlarini ko'rish huquqi yo'q"}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'mentor':
            mentor_groups = Group.objects.filter(mentor=user)
            student_groups = GroupEnrollment.objects.filter(student=student, is_active=True).values_list('group_id', flat=True)
            if not mentor_groups.filter(id__in=student_groups).exists() and (not student.group_id or student.group_id not in mentor_groups.values_list('id', flat=True)):
                return Response({"detail": "Sizda ushbu o'quvchi ma'lumotlarini ko'rish huquqi yo'q"}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        try:
            year = int(request.query_params.get('year', today.year))
            month = int(request.query_params.get('month', today.month))
            if year < 2000 or year > 2100 or month < 1 or month > 12:
                year, month = today.year, today.month
            date_type(year, month, 1)
        except (ValueError, TypeError):
            year, month = today.year, today.month

        # Xavfsiz req_group_id tekshiruvi (null, undefined, bo'sh satr kabilardan himoyalangan)
        raw_group_id = request.query_params.get('group_id')
        req_group_id = None
        if raw_group_id and str(raw_group_id).strip().lower() not in ['null', 'undefined', 'none', '']:
            try:
                req_group_id = int(raw_group_id)
            except (ValueError, TypeError):
                req_group_id = None

        try:
            # O'quvchining barcha guruhlarini olish (faol va o'tgan)
            all_enrollments = list(GroupEnrollment.objects.filter(
                student=student
            ).select_related('group'))

            all_available_groups = [e.group for e in all_enrollments if e.group]
            if not all_available_groups and student.group:
                all_available_groups = [student.group]

            if req_group_id:
                enrollments = [e for e in all_enrollments if e.group_id == req_group_id]
            else:
                enrollments = all_enrollments

            active_groups = [e.group for e in enrollments if e.group]
            if not active_groups and student.group:
                if not req_group_id or student.group.id == req_group_id:
                    active_groups = [student.group]

            # Join date xaritasi
            join_dates = {}
            for e in enrollments:
                join_dates[e.group_id] = e.joined_at.date() if e.joined_at else (student.joined_at.date() if student.joined_at else None)
            if student.group_id and student.group_id not in join_dates:
                join_dates[student.group_id] = student.joined_at.date() if student.joined_at else None

            # Oydagi barcha guruhlarning rejalashtirilgan dars kunlarini olish
            group_lessons_map = {}
            for g in active_groups:
                try:
                    l_dates = set(g.get_lesson_dates(year, month))
                except Exception as ex:
                    logger.warning(f"Error fetching lesson dates for group {g.id}: {ex}")
                    l_dates = set()

                group_lessons_map[g.id] = {
                    'id': g.id,
                    'name': g.name,
                    'color': getattr(g, 'color', '#ffffff'),
                    'lesson_dates': l_dates,
                    'join_date': join_dates.get(g.id)
                }

            # Oydagi mavjud davomat yozuvlarini olish (select_related('group') N+1 query larni oldini oladi)
            attendance_qs = Attendance.objects.filter(
                student=student,
                date__year=year,
                date__month=month
            ).select_related('group')
            if req_group_id:
                attendance_qs = attendance_qs.filter(group_id=req_group_id)

            # Tarixiy yozuvlarda mavjud boshqa guruhlarni ham guruhlar ro'yxatiga qo'shish
            known_group_ids = {g.id for g in active_groups}
            for att in attendance_qs:
                if att.group and att.group.id not in known_group_ids:
                    active_groups.append(att.group)
                    known_group_ids.add(att.group.id)

            att_by_date = {}
            for att in attendance_qs:
                att_date_str = str(att.date)
                if att_date_str not in att_by_date:
                    att_by_date[att_date_str] = []
                att_by_date[att_date_str].append(att)

            # Oydagi barcha kunlar bo'yicha matritsani qurish
            _, last_day_num = monthrange(year, month)
            days_data = []

            total_scheduled = 0
            total_passed = 0
            attended_count = 0
            absent_count = 0
            unconfirmed_count = 0
            future_count = 0

            for day_num in range(1, last_day_num + 1):
                curr_date = date_type(year, month, day_num)
                curr_date_str = str(curr_date)
                is_today = (curr_date == today)
                is_future = (curr_date > today)

                # Bu kunda darsi bor guruhlarni tekshirish
                day_groups_with_lesson = []
                for gid, ginfo in group_lessons_map.items():
                    if curr_date in ginfo['lesson_dates']:
                        day_groups_with_lesson.append(ginfo)

                is_lesson = len(day_groups_with_lesson) > 0
                records_today = att_by_date.get(curr_date_str, [])

                status_str = "no_lesson"
                lesson_groups_names = []

                if is_lesson:
                    total_scheduled += 1
                    lesson_groups_names = [g['name'] for g in day_groups_with_lesson]

                    # O'quvchi bu darsdan keyin qo'shilganmi?
                    joined_all = any(
                        (not ginfo['join_date'] or curr_date >= ginfo['join_date'])
                        for ginfo in day_groups_with_lesson
                    )

                    if not joined_all:
                        status_str = "not_joined"
                    elif is_future:
                        status_str = "future"
                        future_count += 1
                    else:
                        total_passed += 1
                        # O'tib bo'lgan yoki bugungi dars
                        if records_today:
                            confirmed_records = [r for r in records_today if r.marked_by_id is not None]
                            if confirmed_records:
                                if any(r.is_present for r in confirmed_records):
                                    status_str = "present"
                                    attended_count += 1
                                else:
                                    status_str = "absent"
                                    absent_count += 1
                            else:
                                status_str = "unconfirmed"
                                unconfirmed_count += 1
                        else:
                            status_str = "unconfirmed"
                            unconfirmed_count += 1
                elif records_today:
                    # Jadvaldan tashqari dars kuni olingan davomat
                    confirmed_records = [r for r in records_today if r.marked_by_id is not None]
                    if confirmed_records:
                        if any(r.is_present for r in confirmed_records):
                            status_str = "present"
                            attended_count += 1
                            total_passed += 1
                        else:
                            status_str = "absent"
                            absent_count += 1
                            total_passed += 1
                        lesson_groups_names = [r.group_name or (r.group.name if r.group else "Guruh") for r in records_today]
                    else:
                        status_str = "unconfirmed"

                days_data.append({
                    "date": curr_date_str,
                    "day": day_num,
                    "day_of_week": curr_date.weekday(),  # 0=Dushanba, 6=Yakshanba
                    "is_lesson_day": is_lesson or (len(records_today) > 0),
                    "status": status_str,
                    "groups": lesson_groups_names,
                    "is_today": is_today
                })

            if total_passed > 0:
                attendance_rate = round((attended_count / total_passed * 100), 1)
            else:
                # Agar darslar faqat kelajakda bo'lsa yoki dars bo'lmagan bo'lsa
                attendance_rate = 0 if future_count > 0 else 100.0

            return Response({
                "student_id": student.id,
                "student_name": student.full_name,
                "year": year,
                "month": month,
                "groups": [{"id": g.id, "name": g.name} for g in all_available_groups],
                "stats": {
                    "total_scheduled": total_scheduled,
                    "total_passed": total_passed,
                    "attended_count": attended_count,
                    "absent_count": absent_count,
                    "unconfirmed_count": unconfirmed_count,
                    "future_count": future_count,
                    "attendance_rate": attendance_rate
                },
                "days": days_data
            })
        except Exception as e:
            logger.exception("student_monthly action xatoligi: %s", str(e))
            return Response(
                {"detail": "Davomat ma'lumotlarini yuklashda xatolik yuz berdi."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from rest_framework.response import Response
from .services import generate_daily_full_report, get_full_monthly_report
from .models import ReportDownloadTrack
from datetime import datetime, date, timedelta
from drf_spectacular.utils import extend_schema, OpenApiTypes
from django.utils import timezone
from zoneinfo import ZoneInfo

class DailyReportQuerySerializer(serializers.Serializer):
    date = serializers.DateField(required=False, help_text="Sana (YYYY.MM.DD). Default: bugun")

class MonthlyFinanceQuerySerializer(serializers.Serializer):
    year = serializers.IntegerField(required=False)
    month = serializers.IntegerField(required=False)

class PendingNotificationResponseSerializer(serializers.Serializer):
    pending_daily = serializers.BooleanField()
    pending_monthly = serializers.BooleanField()
    daily_message = serializers.CharField(allow_null=True)
    monthly_message = serializers.CharField(allow_null=True)
    uncollected_past = serializers.ListField(child=serializers.DictField(), required=False)

class DailyReportExportView(APIView):
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[DailyReportQuerySerializer], 
        responses={(200, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'): OpenApiTypes.BINARY}
    )
    def get(self, request):
        if request.user.role not in ['admin', 'super_admin']:
            return Response({"error": "Sizda hisobotlarni yuklash huquqi yo'q"}, status=403)

        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y.%m.%d').date()
            except ValueError:
                return HttpResponse(
                    "Sana formati noto'g'ri. Namuna: 2025.01.11", 
                    status=400
                )
        else:
            # Tashkent vaqti bo'yicha bugun
            tashkent_tz = ZoneInfo('Asia/Tashkent')
            target_date = timezone.now().astimezone(tashkent_tz).date()

        # Excelni yaratish
        wb = generate_daily_full_report(target_date)
        
        # Yuklanganligini belgilab qo'yish
        ReportDownloadTrack.objects.get_or_create(
            user=request.user,
            report_type='daily',
            report_date=target_date
        )
        
        filename = f"{target_date.strftime('%Y.%m.%d')}.xlsx"
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        wb.save(response)
        return response

class MonthlyFinanceExportView(APIView):
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[MonthlyFinanceQuerySerializer], 
        responses={(200, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'): OpenApiTypes.BINARY}
    )
    def get(self, request):
        if request.user.role != 'super_admin':
            return Response({"error": "Faqat SuperAdmin hisobotni yuklay oladi"}, status=403)

        tashkent_tz = ZoneInfo('Asia/Tashkent')
        now_tashkent = timezone.now().astimezone(tashkent_tz)

        year = int(request.query_params.get('year', now_tashkent.year))
        month = int(request.query_params.get('month', now_tashkent.month))
        
        wb = get_full_monthly_report(year, month)
        
        # Yuklanganligini belgilab qo'yish
        report_date = date(year, month, 1)
        ReportDownloadTrack.objects.get_or_create(
            user=request.user,
            report_type='monthly',
            report_date=report_date
        )
        
        filename = f"Moliya_Hisoboti_{year}_{month:02d}.xlsx"
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        wb.save(response)
        return response

class CheckPendingNotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PendingNotificationResponseSerializer})
    def get(self, request):
        user = request.user
        if user.role not in ['admin', 'super_admin']:
            return Response({
                "pending_daily": False,
                "pending_monthly": False,
                "daily_message": None,
                "monthly_message": None,
                "uncollected_past": []
            })

        tashkent_tz = ZoneInfo('Asia/Tashkent')
        now_tashkent = timezone.now().astimezone(tashkent_tz)
        today_tashkent = now_tashkent.date()
        current_hour = now_tashkent.hour
        current_minute = now_tashkent.minute
        current_day = now_tashkent.day

        # ──────────────────────────────────────────────
        # 1. CURRENT PENDING: Kunlik hisobot (18:30 dan keyin)
        # ──────────────────────────────────────────────
        pending_daily = False
        is_after_six_thirty = current_hour > 18 or (current_hour == 18 and current_minute >= 30)
        
        if is_after_six_thirty:
            downloaded = ReportDownloadTrack.objects.filter(
                user=user,
                report_type='daily',
                report_date=today_tashkent
            ).exists()
            if not downloaded:
                pending_daily = True

        # ──────────────────────────────────────────────
        # 2. CURRENT PENDING: Oylik moliya hisoboti (28-31 kunlari, faqat super_admin)
        # ──────────────────────────────────────────────
        pending_monthly = False
        if user.role == 'super_admin' and current_day in [28, 29, 30, 31]:
            monthly_report_date = date(now_tashkent.year, now_tashkent.month, 1)
            downloaded_monthly = ReportDownloadTrack.objects.filter(
                user=user,
                report_type='monthly',
                report_date=monthly_report_date
            ).exists()
            if not downloaded_monthly:
                pending_monthly = True

        # ──────────────────────────────────────────────
        # 3. O'TGAN DAVRLAR: Yuklab olinmagan hisobotlar
        # ──────────────────────────────────────────────
        uncollected_past = []

        # 3a. Kunlik hisobotlar — oxirgi 14 kun (bugundan tashqari)
        downloaded_daily_dates = set(
            ReportDownloadTrack.objects.filter(
                user=user,
                report_type='daily',
            ).values_list('report_date', flat=True)
        )
        for i in range(1, 15):
            d = today_tashkent - timedelta(days=i)
            if d not in downloaded_daily_dates:
                uncollected_past.append({
                    'type': 'daily',
                    'date': d.strftime('%Y.%m.%d'),
                    'label': f"Kunlik hisobot — {d.strftime('%d.%m.%Y')}",
                    'report_date': d.isoformat(),
                })

        # 3b. Oylik moliya hisobotlari — oxirgi 12 oy (faqat super_admin)
        if user.role == 'super_admin':
            current_month_date = date(now_tashkent.year, now_tashkent.month, 1)
            downloaded_monthly_dates = set(
                ReportDownloadTrack.objects.filter(
                    user=user,
                    report_type='monthly',
                ).values_list('report_date', flat=True)
            )
            for i in range(1, 13):
                # Har oyning 1-sanasi bilan tekshiramiz
                if now_tashkent.month - i > 0:
                    m = now_tashkent.month - i
                    y = now_tashkent.year
                else:
                    m = 12 + (now_tashkent.month - i)
                    y = now_tashkent.year - 1
                month_date = date(y, m, 1)
                if month_date not in downloaded_monthly_dates:
                    month_names = [
                        '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
                        'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
                    ]
                    uncollected_past.append({
                        'type': 'monthly',
                        'date': month_date.strftime('%Y.%m.%d'),
                        'label': f"Oylik moliya — {month_names[m]} {y}",
                        'report_date': month_date.isoformat(),
                    })

        # 3c. Davomat oylik hisobotlari — oxirgi 12 oy
        downloaded_attendance_dates = set(
            ReportDownloadTrack.objects.filter(
                user=user,
                report_type='attendance_monthly',
            ).values_list('report_date', flat=True)
        )
        for i in range(1, 13):
            if now_tashkent.month - i > 0:
                m = now_tashkent.month - i
                y = now_tashkent.year
            else:
                m = 12 + (now_tashkent.month - i)
                y = now_tashkent.year - 1
            month_date = date(y, m, 1)
            if month_date not in downloaded_attendance_dates:
                month_names = [
                    '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
                    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
                ]
                uncollected_past.append({
                    'type': 'attendance_monthly',
                    'date': month_date.strftime('%Y.%m.%d'),
                    'label': f"Davomat hisoboti — {month_names[m]} {y}",
                    'report_date': month_date.isoformat(),
                })

        # Eng yangilari birinchi, keyin 15 tagacha
        uncollected_past.sort(key=lambda x: x['date'], reverse=True)
        uncollected_past = uncollected_past[:15]

        return Response({
            "pending_daily": pending_daily,
            "pending_monthly": pending_monthly,
            "daily_message": "Bugungi kundalik Excel hisoboti tayyor. Iltimos, uni yuklab oling!" if pending_daily else None,
            "monthly_message": "Ushbu oy uchun oylik moliya hisoboti tayyor. Iltimos, uni yuklab oling!" if pending_monthly else None,
            "uncollected_past": uncollected_past
        })
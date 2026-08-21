from django.contrib import admin
from .models import ReportDownloadTrack

@admin.register(ReportDownloadTrack)
class ReportDownloadTrackAdmin(admin.ModelAdmin):
    list_display = ('user', 'report_type', 'report_date', 'downloaded_at')
    list_filter = ('report_type', 'report_date')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')
    date_hierarchy = 'downloaded_at'

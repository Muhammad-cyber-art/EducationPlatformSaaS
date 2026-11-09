from openpyxl.styles import Alignment
from django.db.models import Prefetch
from homework_attends.models import Attendance, Homework, HomeworkSubmission
from .base import BaseReportService
import gc

class DailyAttendanceReport(BaseReportService):
    
    def generate(self):
        ws = self.wb.active
        ws.title = f"Hisobot {self.target_date.strftime('%Y.%m.%d')}"

        headers = [
            "№", "Filial", "Guruh", "O'quvchi F.I.SH", 
            "Davomat", "Uy vazifasi (Mavzu)", "Vazifa holati"
        ]
        self.apply_headers(ws, headers)

        # Base queryset
        qs = (
            Attendance.objects
            .filter(
                date=self.target_date,
                group__isnull=False,
                student__isnull=False,
            )
            .select_related('student', 'group', 'group__branch')
            .order_by('group__branch__name', 'group__name', 'student__full_name')
        )
        
        # Apply security scope
        qs = self.apply_security_scope(qs, branch_field='group__branch')

        from reports.queries import with_homework_status
        qs = with_homework_status(qs)
        status_labels = dict(HomeworkSubmission.STATUS_CHOICES)

        for index, att in enumerate(qs.iterator(chunk_size=1000), start=1):
            student = att.student
            group = att.group
            branch = group.branch

            hw_title = att.report_homework_title or "Vazifa berilmagan"
            hw_status = status_labels.get(att.report_submission_status, "Topshirmagan") if att.report_homework_id else "-"

            row_data = [
                index,
                branch.name if branch else "Filialsiz",
                group.name,
                student.full_name,
                "✅ Keldi" if att.is_present else "❌ Kelmadi",
                hw_title,
                hw_status
            ]
            ws.append(row_data)

            # Styling for the new row
            for cell in ws[index + 1]:
                cell.border = self.border
                cell.alignment = Alignment(vertical="center", horizontal="left")
                if cell.column in [1, 5, 7]:
                    cell.alignment = Alignment(horizontal="center", vertical="center")

        dims = {
            'A': 5, 'B': 20, 'C': 20, 'D': 35, 
            'E': 15, 'F': 30, 'G': 20
        }
        self.auto_adjust_widths(ws, dims)
        
        # Free up memory explicitly
        gc.collect()

        return self.wb

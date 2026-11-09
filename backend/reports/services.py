import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from django.utils import timezone
from homework_attends.models import Attendance, Homework, HomeworkSubmission
from groups.models import Group

def generate_daily_full_report(target_date=None, *, user, streaming=False):
    from openpyxl.cell import WriteOnlyCell
    from permissions.scopes import scope_report
    from reports.queries import with_homework_status

    target_date = target_date or timezone.localdate()
    wb = openpyxl.Workbook(write_only=streaming)
    ws = wb.create_sheet() if streaming else wb.active
    ws.title = f"Hisobot {target_date:%Y.%m.%d}"
    for column, width in {'A': 5, 'B': 20, 'C': 20, 'D': 35, 'E': 15, 'F': 30, 'G': 20}.items():
        ws.column_dimensions[column].width = width
    border = Border(**{side: Side(style='thin') for side in ('left', 'right', 'top', 'bottom')})
    header_font = Font(bold=True, color='FFFFFF', size=12)
    header_fill = PatternFill(start_color='1F4E78', end_color='1F4E78', fill_type='solid')

    def append(values, header=False):
        cells = []
        for index, value in enumerate(values, 1):
            cell = WriteOnlyCell(ws, value=value)
            # Treat user-entered text as text, never as an Excel formula.
            if isinstance(value, str):
                cell.data_type = 's'
            cell.border = border
            cell.alignment = Alignment(vertical='center', horizontal='center' if header or index in (1, 5, 7) else 'left', wrap_text=header)
            if header:
                cell.font = header_font
                cell.fill = header_fill
            cells.append(cell)
        ws.append(cells)

    append(['№', 'Filial', 'Guruh', "O'quvchi F.I.SH", 'Davomat', 'Uy vazifasi (Mavzu)', 'Vazifa holati'], header=True)
    queryset = Attendance.objects.filter(
        date=target_date, group__isnull=False, student__isnull=False,
    ).select_related('student', 'group__branch').order_by('group__branch__name', 'group__name', 'student__full_name')
    queryset = with_homework_status(scope_report(queryset, user))
    labels = dict(HomeworkSubmission.STATUS_CHOICES)
    for index, attendance in enumerate(queryset.iterator(chunk_size=1000), 1):
        append([
            index, attendance.group.branch.name, attendance.group.name, attendance.student.full_name,
            'Keldi' if attendance.is_present else 'Kelmadi',
            attendance.report_homework_title or 'Vazifa berilmagan',
            labels.get(attendance.report_submission_status, 'Topshirmagan') if attendance.report_homework_id else '-',
        ])
    return wb

import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from django.db.models import Sum, F
from finance.models import Payment, EmployeePayment, FinanceTransaction
from branches.models import Branch

def get_full_monthly_report(year, month):
    wb = openpyxl.Workbook()
    
    # --- Stillar ---
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    border = Border(left=Side(style='thin'), right=Side(style='thin'), 
                    top=Side(style='thin'), bottom=Side(style='thin'))
    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")

    # ================================================================
    # 1-SAHIFA: O'QUVCHILAR TO'LOVLARI (BATAFSIL RO'YXAT)
    # ================================================================
    ws1 = wb.active
    ws1.title = "O'quvchilar To'lovlari"
    
    headers1 = [
        "№", "Filial", "O'quvchi F.I.SH", "Guruh", "To'lov Summasi", 
        "To'lov Oyi", "Tasdiqlagan Admin", "To'langan Vaqt", "Tranzaksiya ID"
    ]
    ws1.append(headers1)
    for cell in ws1[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center
        cell.border = border

    # Ma'lumotlarni olish
    # BUG FIX #3: group va group__branch NULL bo'lmasligi shart.
    # O'chirilgan guruhga tegishli Paymentlar Excel'ga tushmaydi.
    student_payments = (
        Payment.objects
        .filter(
            month__year=year,
            month__month=month,
            paid_amount__gt=0,
            group__isnull=False,          # o'chirilgan guruhlar chiqmasin
            group__branch__isnull=False,  # filialsiz guruhlar chiqmasin
            student__isnull=False,        # o'chirilgan studentlar chiqmasin
        )
        .select_related(
            'student', 'group', 'group__branch', 'marked_by'
        )
        .order_by('group__branch', 'student__full_name')
    )

    for i, sp in enumerate(student_payments.iterator(chunk_size=1000), 1):
        ws1.append([
            i,
            sp.group.branch.name if sp.group.branch else "-",
            sp.student.full_name,
            sp.group.name,
            sp.paid_amount,
            sp.month.strftime("%Y-%m") if sp.month else "-",
            sp.marked_by.get_full_name() or sp.marked_by.username if sp.marked_by else "Onlayn",
            sp.paid_at.strftime("%Y-%m-%d %H:%M") if sp.paid_at else "-",
            sp.transaction_id or "-"
        ])

    # ================================================================
    # 2-SAHIFA: XODIMLAR MAOSHLARI (BATAFSIL RO'YXAT)
    # ================================================================
    ws2 = wb.create_sheet("Xodimlar Maoshlari")
    headers2 = [
        "№", "Filial", "Xodim F.I.SH", "Roli", "Asosiy Maosh", 
        "Bonus", "Jarimalar", "JAMI TO'LANDI", "Tasdiqladi (SuperAdmin)", "Sana"
    ]
    ws2.append(headers2)
    for cell in ws2[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center
        cell.border = border

    employee_payments = EmployeePayment.objects.filter(
        month__year=year, month__month=month, is_paid=True
    ).select_related('employee', 'employee__branch', 'marked_by').order_by('employee__branch')

    for i, ep in enumerate(employee_payments.iterator(chunk_size=1000), 1):
        total_paid = float(ep.salary_base + ep.bonus - ep.deductions)
        ws2.append([
            i,
            ep.employee.branch.name if ep.employee.branch else "-",
            ep.employee.get_full_name() or ep.employee.username,
            ep.employee.get_role_display(),
            ep.salary_base,
            ep.bonus,
            ep.deductions,
            total_paid,
            ep.marked_by.get_full_name() or ep.marked_by.username if ep.marked_by else "Tizim",
            ep.paid_at.strftime("%Y-%m-%d") if ep.paid_at else "-"
        ])

    # ================================================================
    # 3-SAHIFA: BOSHQA AMALLAR (REFUND, EXTRA, UTILITY)
    # ================================================================
    ws_extra = wb.create_sheet("Refund va Qo'shimcha Amallar")
    headers_extra = [
        "№", "Filial", "Tur", "Turkum", "Sarlavha", "Summa", "Mas'ul", "Sana", "Tavsif"
    ]
    ws_extra.append(headers_extra)
    for cell in ws_extra[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center
        cell.border = border

    other_transactions = FinanceTransaction.objects.filter(
        date__year=year, date__month=month
    ).exclude(category__in=['student_fee', 'salary']).select_related('branch', 'marked_by').order_by('date')

    for i, tr in enumerate(other_transactions.iterator(chunk_size=1000), 1):
        ws_extra.append([
            i,
            tr.branch.name if tr.branch else "-",
            tr.get_transaction_type_display(),
            tr.get_category_display(),
            tr.title,
            tr.amount,
            tr.marked_by.get_full_name() or tr.marked_by.username if tr.marked_by else "Tizim",
            tr.date.strftime("%Y-%m-%d"),
            tr.description or "-"
        ])

    # ================================================================
    # 4-SAHIFA: FILIALLAR VA UMUMIY STATISTIKA (TUGATILDI)
    # ================================================================
    ws3 = wb.create_sheet("Umumiy Statistika")
    headers3 = [
        "Filial Nomi", "O'quvchilar To'lovi", "Qo'shimcha Kirim", 
        "Xodimlar Maoshi", "Refundlar (Chiqim)", "Kommunal To'lovlar",
        "Boshqa Chiqimlar", "SOF FOYDA", "Qarzdorlik"
    ]
    ws3.append(headers3)
    for cell in ws3[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center
        cell.border = border

    branches = Branch.objects.all()
    grand_income_fees = 0
    grand_income_extra = 0
    grand_expense_salary = 0
    grand_expense_refund = 0
    grand_expense_utility = 0
    grand_expense_other = 0
    grand_debt = 0

    from reports.queries import monthly_branch_totals
    branch_totals = monthly_branch_totals(year, month)
    for branch in branches:
        totals = branch_totals.get(branch.pk, {})
        income_fees = totals.get('inc_fees', 0)
        income_extra = totals.get('inc_extra', 0)
        expense_salary = totals.get('exp_salary', 0)
        expense_refund = totals.get('exp_refund', 0)
        expense_utility = totals.get('exp_util', 0)
        expense_other = totals.get('exp_other', 0)
        debt = totals.get('debt', 0)

        net_profit = (income_fees + income_extra) - (expense_salary + expense_refund + expense_utility + expense_other)
        
        ws3.append([
            branch.name, 
            income_fees, 
            income_extra, 
            expense_salary, 
            expense_refund, 
            expense_utility,
            expense_other, 
            net_profit, 
            debt
        ])
        
        grand_income_fees += income_fees
        grand_income_extra += income_extra
        grand_expense_salary += expense_salary
        grand_expense_refund += expense_refund
        grand_expense_utility += expense_utility
        grand_expense_other += expense_other
        grand_debt += debt

    # Jami qatori
    total_net = (grand_income_fees + grand_income_extra) - (grand_expense_salary + grand_expense_refund + grand_expense_utility + grand_expense_other)
    total_row = [
        "UMUMIY JAMI", 
        grand_income_fees, 
        grand_income_extra, 
        grand_expense_salary, 
        grand_expense_refund, 
        grand_expense_utility,
        grand_expense_other, 
        total_net, 
        grand_debt
    ]
    ws3.append(total_row)
    for cell in ws3[ws3.max_row]:
        cell.font = Font(bold=True)
        cell.border = border

    # --- Ustun kengliklarini matn uzunligiga qarab avtomatik to'g'rilash ---
    for sheet in wb.worksheets:
        for col_idx, column_cells in enumerate(sheet.columns, start=1):
            max_length = 0
            column_letter = get_column_letter(col_idx)
            for cell in column_cells:
                try:
                    if cell.value:
                        val_len = len(str(cell.value))
                        if val_len > max_length: max_length = val_len
                except: pass
            sheet.column_dimensions[column_letter].width = min(max(max_length + 3, 12), 50)

    return wb

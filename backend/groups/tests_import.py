"""Student file upload, review, permissions and atomic persistence regressions."""
import io
import subprocess
import os
from pathlib import Path
import tempfile
from itertools import permutations
from decimal import Decimal
from unittest.mock import patch
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from django.db import connection, close_old_connections
from django.urls import reverse
from django.utils import timezone
from openpyxl import Workbook
from PIL import Image, ImageDraw, ImageFont
from rest_framework.test import APITestCase

from authenticatsiya.models import BranchAccess
from branches.models import Branch
from finance.models import Payment, StudentFinanceProfile
from groups.importer import extract_students, normalize_uz_phone, MAX_ROWS
from groups.ocr import OCRUnavailable, resolve_ocr_command, ocr_arguments
from groups.models import Group, GroupEnrollment, Student
from permissions.models import StaffPermission


def xlsx_bytes(rows):
    workbook = Workbook()
    for row in rows:
        workbook.active.append(row)
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


class OCRResolutionTests(SimpleTestCase):
    @override_settings(STUDENT_OCR_COMMAND='tesseract')
    def test_old_settings_discover_local_install_at_request_time(self):
        expected = str(Path(settings.BASE_DIR) / '.tools' / 'tesseract' / 'tesseract.exe')
        with patch('groups.ocr.shutil.which', side_effect=lambda value: expected if value == expected else None):
            self.assertEqual(resolve_ocr_command(), expected)

    @override_settings(STUDENT_OCR_COMMAND='"C:/custom OCR/tesseract.exe"')
    def test_quoted_custom_command_is_respected(self):
        with patch('groups.ocr.shutil.which', return_value='C:/custom OCR/tesseract.exe') as lookup:
            self.assertEqual(resolve_ocr_command(), 'C:/custom OCR/tesseract.exe')
        lookup.assert_called_once_with('C:/custom OCR/tesseract.exe')

    @override_settings(STUDENT_OCR_COMMAND='C:/missing/tesseract.exe')
    def test_bad_custom_install_is_service_error(self):
        with patch('groups.ocr.shutil.which', return_value=None) as lookup:
            with self.assertRaises(OCRUnavailable):
                resolve_ocr_command()
        self.assertEqual(lookup.call_count, 1)

    @override_settings(STUDENT_OCR_LANGUAGES='eng+uzb+rus')
    def test_missing_local_language_models_is_service_error(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'tessdata').mkdir()
            with self.assertRaises(OCRUnavailable):
                ocr_arguments(str(Path(directory) / 'tesseract.exe'))


class FileExtractionTests(SimpleTestCase):
    @skipUnless(os.name == 'nt' and (Path(settings.BASE_DIR) / '.tools/tesseract/tesseract.exe').is_file(),
                'Requires project-local Windows Tesseract')
    def test_real_ocr_reads_bordered_and_reduced_tables(self):
        for size, scale in [(24, 1), (14, 1), (24, 0.5)]:
            with self.subTest(size=size, scale=scale):
                image = Image.new('RGB', (1500, 260), 'white')
                draw = ImageDraw.Draw(image)
                font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', size)
                columns = [0, 80, 600, 1000, 1499]
                data = [['No', 'Ism familiya', 'Telefon', 'Ota ona telefoni'],
                        ['1', 'Abdullayev Sardor', '901234567', '941112233'],
                        ['2', 'Karimova Madina', '937654321', '954445566']]
                for index, row in enumerate(data):
                    for x, value in zip(columns, row):
                        draw.text((x + 12, index * 80 + 18), value, fill='black', font=font)
                for x in columns:
                    draw.line((x, 0, x, 240), fill='black', width=2)
                for y in [0, 80, 160, 240]:
                    draw.line((0, y, 1499, y), fill='black', width=2)
                if scale != 1:
                    image = image.resize((round(image.width * scale), round(image.height * scale)))
                output = io.BytesIO()
                image.save(output, format='PNG')
                rows = extract_students(output.getvalue(), 'table.png')
                self.assertEqual([row['full_name'] for row in rows], ['Abdullayev Sardor', 'Karimova Madina'])
                self.assertEqual([row['phone'] for row in rows], ['+998901234567', '+998937654321'])
                self.assertEqual([row['parent_phone'] for row in rows], ['+998941112233', '+998954445566'])

    def test_ocr_failure_identifies_processing_stage(self):
        for lines, message in [([], 'Rasmdan matn o‘qilmadi'),
                               (['unreadable text without any phones'], 'matn o‘qildi, lekin')]:
            with self.subTest(lines=lines), patch('groups.importer._ocr_lines', return_value=lines):
                with self.assertRaisesMessage(ValueError, message):
                    extract_students(b'ocr-is-mocked', 'table.png')

    def test_unknown_headers_infer_reordered_columns_from_second_row(self):
        values = {'serial': '1', 'name': 'Abdullayev Sardor', 'phone': '901234567', 'parent': '937654321'}
        for order in permutations(values):
            with self.subTest(order=order):
                data = xlsx_bytes([['Column ' + str(i) for i in range(4)], [values[key] for key in order]])
                row = extract_students(data, 'students.xlsx')[0]
                self.assertEqual(row['full_name'], 'Abdullayev Sardor')
                phones = [values[key] for key in order if key in {'phone', 'parent'}]
                self.assertEqual(row['phone'], '+998' + phones[0])
                self.assertEqual(row['parent_phone'], '+998' + phones[1])
                self.assertEqual(row['row'], 2)

    def test_headerless_table_keeps_first_student_and_ignores_ordinals(self):
        data = '1,901234567,Abdullayev Sardor,937654321\n2,331234567,Karimova Madina,\n'
        rows = extract_students(data.encode(), 'students.csv')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['phone'], '+998901234567')
        self.assertEqual(rows[0]['parent_phone'], '+998937654321')
        self.assertEqual(rows[1]['parent_phone'], '')
        self.assertEqual(rows[0]['row'], 1)

    def test_ordinal_header_does_not_override_phone_content(self):
        data = xlsx_bytes([['Raqam', 'Telefon', 'F.I.SH', 'Telefon'],
                           [1, 901234567, 'Abdullayev Sardor', 937654321]])
        row = extract_students(data, 'students.xlsx')[0]
        self.assertEqual(row['phone'], '+998901234567')
        self.assertEqual(row['parent_phone'], '+998937654321')

    def test_named_parent_column_and_repeated_headers(self):
        data = xlsx_bytes([['Ota-ona telefoni', 'F.I.SH', 'Telefon'],
                           [937654321, 'Ali Vali', 901234567],
                           ['Ota-ona telefoni', 'F.I.SH', 'Telefon']])
        rows = extract_students(data, 'students.xlsx')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['phone'], '+998901234567')
        self.assertEqual(rows[0]['parent_phone'], '+998937654321')

    def test_content_inference_requires_more_than_ten_letters(self):
        with self.assertRaises(ValueError):
            extract_students(b'X,Y,Z\n1,Ali Vali,901234567\n', 'a.csv')

    def test_ocr_recognizes_two_phones_before_or_after_name(self):
        for line in ['1 901234567 Abdullayev Sardor 937654321',
                     '1 901234567 937654321 Abdullayev Sardor',
                     '1 Abdullayev Sardor 901234567 937654321',
                     '1 | 901234567 | Abdullayev Sardor | 937654321']:
            with self.subTest(line=line), patch('groups.importer._ocr_lines', return_value=[line]):
                row = extract_students(b'ocr-is-mocked', 'a.png')[0]
                self.assertEqual(row['full_name'], 'Abdullayev Sardor')
                self.assertEqual(row['phone'], '+998901234567')
                self.assertEqual(row['parent_phone'], '+998937654321')

    def test_numeric_phones_and_missing_cells(self):
        rows = extract_students(xlsx_bytes([
            ['Ism', 'Familiya', 'Telefon'],
            ['Ali', 'Valiyev', 998901234567.0],
            [None, None, 931234567],
            ['Vali', None, None],
        ]), 'students.xlsx')
        self.assertEqual(rows[0]['phone'], '+998901234567')
        self.assertEqual(rows[1]['full_name'], '')
        self.assertEqual(rows[2]['raw_phone'], '')
        self.assertNotIn('nan', str(rows))

    def test_phone_normalization_rejects_garbage(self):
        for phone in [998901234567.0, '998901234567.0', '+998 (90) 123-45-67', '901234567']:
            self.assertEqual(normalize_uz_phone(phone), '+998901234567')
        for phone in ['hello901234567', '90123456O', None, float('nan')]:
            self.assertIsNone(normalize_uz_phone(phone))

    def test_bom_semicolon_cyrillic_csv(self):
        rows = extract_students('\ufeffФИО;Телефон\nАли Вали;901234567\n'.encode(), 'a.csv')
        self.assertEqual(rows[0]['full_name'], 'Али Вали')

    def test_title_before_header_and_blank_lines(self):
        rows = extract_students(xlsx_bytes([['List'], [], ['F.I.SH', 'Telefon'],
                                            ['Ali Vali', 901234567]]), 'a.xlsx')
        self.assertEqual(rows[0]['row'], 4)

    def test_row_limit_rejects_entire_file(self):
        data = 'Ism,Telefon\n' + 'Ali,901234567\n' * (MAX_ROWS + 1)
        with self.assertRaises(ValueError):
            extract_students(data.encode(), 'a.csv')

    def test_invalid_empty_unsupported_files(self):
        for data, name in [(b'', 'a.csv'), (b'garbage', 'a.xlsx'), (b'garbage', 'a.png'),
                           (b'abc', 'a.exe'), (b'abc', 'a.xls'), (b'unknown,columns\na,b', 'a.csv')]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                extract_students(data, name)

    def test_zip_expansion_limit(self):
        import zipfile
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('huge.xml', b'0' * (51 * 1024 * 1024))
        with self.assertRaisesMessage(ValueError, 'hajmi'):
            extract_students(output.getvalue(), 'a.xlsx')

    def test_ocr_pipeline_invocation_and_all_local_prefixes(self):
        output = io.BytesIO()
        Image.new('RGB', (800, 100), 'white').save(output, format='PNG')
        text = 'F.I.SH Telefon\n1. Ali Vali +998 90 123 45 67\n2. G‘ani O‘ktam 33 123 45 67\n'
        process = subprocess.CompletedProcess([], 0, stdout=text.encode(), stderr=b'')
        with patch('groups.importer.resolve_ocr_command', return_value='/fake-ocr/tesseract'), patch('groups.importer.subprocess.run', return_value=process) as run:
            rows = extract_students(output.getvalue(), 'a.png')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]['phone'], '+998331234567')
        self.assertEqual(rows[1]['full_name'], 'G‘ani O‘ktam')
        self.assertEqual(run.call_args.kwargs['timeout'], 25)
        self.assertEqual(run.call_args.kwargs['env']['OMP_THREAD_LIMIT'], '1')

    def test_ocr_missing_and_timeout_are_actionable(self):
        output = io.BytesIO()
        Image.new('RGB', (20, 20)).save(output, format='PNG')
        for exc, expected in [(FileNotFoundError(), OCRUnavailable),
                              (PermissionError(), OCRUnavailable),
                              (subprocess.CalledProcessError(1, 'tesseract', stderr=b'missing model'), OCRUnavailable),
                              (subprocess.TimeoutExpired('tesseract', 25), ValueError)]:
            with patch('groups.importer.resolve_ocr_command', return_value='/fake-ocr/tesseract'), patch('groups.importer.subprocess.run', side_effect=exc), self.assertRaises(expected):
                extract_students(output.getvalue(), 'a.png')


class StudentImportTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name='Import branch')
        self.other = Branch.objects.create(name='Other branch')
        self.admin = get_user_model().objects.create_user(username='import_admin', role='admin', branch=self.branch)
        self.mentor = get_user_model().objects.create_user(username='import_mentor', role='mentor', branch=self.branch)
        self.group = Group.objects.create(name='Import group', branch=self.branch, monthly_price=500000)
        self.other_group = Group.objects.create(name='Other group', branch=self.other)
        self.client.force_authenticate(self.admin)
        self.url = reverse('student-import-file')

    def upload(self, content='F.I.SH,Telefon\nAli Vali,901234567\n', **kwargs):
        file = SimpleUploadedFile('students.csv', content.encode(), content_type='text/csv')
        return self.client.post(self.url, {'file': file, **kwargs}, format='multipart')

    def confirm(self, rows=None, **kwargs):
        return self.client.post(self.url, {'mode': 'confirm', 'group_id': self.group.pk,
            'students': rows if rows is not None else [{'full_name': 'Ali Vali', 'phone': '901234567'}],
            **kwargs}, format='json')

    def test_reordered_file_preview_and_confirm_save_parent_phone(self):
        preview = self.upload('A,B,C,D\n1,901234567,Abdullayev Sardor,937654321\n',
                              mode='preview', group_id=self.group.pk)
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data['students'][0]['parent_phone'], '+998937654321')
        self.assertFalse(Student.objects.exists())
        saved = self.confirm(preview.data['students'])
        self.assertEqual(saved.data['created_count'], 1, saved.data)
        self.assertEqual(Student.objects.get().parent_phone, '937654321')

    def test_missing_parent_phone_markers_save_as_empty(self):
        rows = [{'full_name': 'Abdullayev Sardor', 'phone': f'9012345{index:02d}',
                 'parent_phone': marker}
                for index, marker in enumerate(['', None, '-', '—', 'xxxxxx', '  '])]
        result = self.confirm(rows)
        self.assertEqual(result.data['created_count'], len(rows), result.data)
        self.assertEqual(result.data['failed_count'], 0)
        self.assertTrue(all(not value for value in Student.objects.values_list('parent_phone', flat=True)))

    def test_invalid_parent_phone_is_preserved_for_retry(self):
        rows = [{'full_name': 'Abdullayev Sardor', 'phone': '901234567', 'parent_phone': 'bad'}]
        result = self.confirm(rows)
        self.assertEqual(result.data['failed_count'], 1, result.data)
        self.assertEqual(result.data['failed_students'][0]['parent_phone'], 'bad')
        self.assertFalse(Student.objects.exists())
        rows[0].update(parent_phone='', raw_parent_phone='937654321')
        self.assertEqual(self.confirm(rows).data['created_count'], 1)
        self.assertFalse(Student.objects.get().parent_phone)

    def test_preview_has_no_writes_then_confirmation_saves_corrected_data(self):
        preview = self.upload(mode='preview', group_id=self.group.pk)
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(Student.objects.count(), 0)
        rows = preview.data['students']
        rows[0]['full_name'] = 'Ali Corrected'
        response = self.confirm(rows)
        self.assertEqual(response.data['created_count'], 1, response.data)
        student = Student.objects.get()
        self.assertEqual(student.full_name, 'Ali Corrected')
        self.assertEqual(student.group_id, self.group.pk)
        self.assertEqual(student.branch_id, self.branch.pk)
        self.assertTrue(GroupEnrollment.objects.filter(student=student, group=self.group, is_active=True).exists())
        self.assertTrue(StudentFinanceProfile.objects.filter(student=student).exists())
        self.assertEqual(Payment.objects.get().amount, Decimal('500000'))

    def test_group_only_cannot_bypass_branch_permission(self):
        with patch('groups.importer.extract_students') as parse:
            response = self.upload(group_id=self.other_group.pk, mode='preview')
        self.assertEqual(response.status_code, 403)
        parse.assert_not_called()
        self.assertEqual(Student.objects.count(), 0)

    def test_explicit_branch_must_match_group(self):
        response = self.upload(group_id=self.other_group.pk, branch_id=self.branch.pk)
        self.assertEqual(response.status_code, 400)

    def test_bad_target_ids_never_fall_back_silently(self):
        for extra in [{'group_id': 'bad'}, {'branch_id': '-1'}, {'group_id': 0}, {'branch_id': 0},
                      {'group_id': 10 ** 30}, {'group_id': 987654}, {'branch_id': 987654}]:
            with self.subTest(extra=extra):
                self.assertIn(self.upload(**extra).status_code, [400, 403])
        self.assertFalse(Student.objects.exists())

    def test_additional_branch_access(self):
        BranchAccess.objects.create(user=self.admin, branch=self.other)
        response = self.upload(group_id=self.other_group.pk)
        self.assertEqual(response.data['created_count'], 1, response.data)
        self.assertEqual(Student.objects.get().branch_id, self.other.pk)

    def test_read_only_mentor_cannot_import(self):
        StaffPermission.objects.create(user=self.mentor, permissions={'students': ['view']})
        self.client.force_authenticate(self.mentor)
        self.assertEqual(self.confirm().status_code, 403)

    def test_authorized_mentor_can_import_only_in_allowed_branch(self):
        StaffPermission.objects.create(user=self.mentor, permissions={'students': ['create']})
        self.client.force_authenticate(self.mentor)
        self.assertEqual(self.confirm().data['created_count'], 1)
        self.assertEqual(self.confirm(group_id=self.other_group.pk).status_code, 403)

    def test_confirm_rechecks_permissions(self):
        BranchAccess.objects.create(user=self.admin, branch=self.other)
        self.assertEqual(self.upload(mode='preview', group_id=self.other_group.pk).status_code, 200)
        BranchAccess.objects.filter(user=self.admin).delete()
        self.assertEqual(self.confirm(group_id=self.other_group.pk).status_code, 403)

    def test_retry_and_duplicate_rows_do_not_duplicate_records_or_invoices(self):
        rows = [{'full_name': 'Ali Vali', 'phone': '901234567'}] * 2
        self.assertEqual(self.confirm(rows).data['created_count'], 1)
        invoice = Payment.objects.get()
        invoice.paid_amount = 100000
        invoice.save()
        response = self.confirm(rows)
        self.assertEqual(response.data['failed_count'], 0)
        self.assertEqual(Student.objects.count(), 1)
        self.assertEqual(GroupEnrollment.objects.count(), 1)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(Payment.objects.get().paid_amount, 100000)

    def test_existing_student_gets_group_without_losing_other_enrollment(self):
        old_group = Group.objects.create(name='Original group', branch=self.branch)
        student = Student.objects.create(full_name='Ali Vali', phone='901234567', branch=self.branch, group=old_group)
        response = self.confirm()
        self.assertEqual(response.data['existing_count'], 1, response.data)
        self.assertEqual(student.enrollments.filter(is_active=True).count(), 2)
        student.refresh_from_db()
        self.assertEqual(student.group_id, old_group.pk)

    def test_inactive_enrollment_reactivated_and_primary_group_set(self):
        student = Student.objects.create(full_name='Ali Vali', phone='901234567', branch=self.branch)
        enrollment = GroupEnrollment.objects.create(student=student, group=self.group, is_active=False, left_at=timezone.now())
        self.assertEqual(self.confirm().data['existing_count'], 1)
        enrollment.refresh_from_db(); student.refresh_from_db()
        self.assertTrue(enrollment.is_active)
        self.assertIsNone(enrollment.left_at)
        self.assertEqual(student.group_id, self.group.pk)

    def test_existing_other_branch_or_archived_or_mismatching_name_rejected(self):
        student = Student.objects.create(full_name='Ali Vali', phone='901234567', branch=self.other)
        self.assertEqual(self.confirm().data['failed_count'], 1)
        student.branch = self.branch; student.is_archived = True; student.save()
        self.assertEqual(self.confirm().data['failed_count'], 1)
        student.is_archived = False; student.full_name = 'Different person'; student.save()
        self.assertEqual(self.confirm().data['failed_count'], 1)
        self.assertEqual(Student.objects.count(), 1)
        self.assertFalse(GroupEnrollment.objects.exists())

    def test_partial_failure_preserves_row_details(self):
        response = self.confirm([{'row': 8, 'full_name': '', 'phone': '123'},
                                 {'row': 9, 'full_name': 'Ali Vali', 'phone': '901234567'}])
        self.assertEqual(response.data['created_count'], 1)
        self.assertEqual(response.data['failed_students'][0]['row'], 8)

    def test_cleared_preview_phone_is_not_restored_from_raw_value(self):
        response = self.confirm([{'full_name': 'Ali Vali', 'phone': '', 'raw_phone': '901234567'}])
        self.assertEqual(response.data['failed_count'], 1)
        self.assertFalse(Student.objects.exists())

    def test_non_text_name_rejected(self):
        response = self.confirm([{'full_name': {'name': 'Ali'}, 'phone': '901234567'}])
        self.assertEqual(response.data['failed_count'], 1)

    def test_invalid_mode_and_missing_file(self):
        self.assertEqual(self.client.post(self.url, {'mode': []}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 400)

    def test_all_row_errors_return_structured_results(self):
        response = self.confirm([{'row': 7, 'full_name': 'Ali', 'phone': 'bad'}])
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['failed_students'][0]['row'], 7)

    def test_invoice_failure_rolls_back_student_wallet_and_enrollment(self):
        with patch('finance.models.Payment.objects.get_or_create', side_effect=RuntimeError('private database detail')):
            response = self.confirm()
        self.assertEqual(response.data['failed_count'], 1)
        self.assertFalse(Student.objects.exists())
        self.assertFalse(StudentFinanceProfile.objects.exists())
        self.assertFalse(GroupEnrollment.objects.exists())
        self.assertNotIn('private database detail', str(response.data))

    def test_archived_group_rejected(self):
        self.group.is_archived = True; self.group.save()
        self.assertEqual(self.confirm().status_code, 400)

    def test_oversized_file_rejected_before_parsing(self):
        from groups.importer import MAX_FILE_BYTES
        file = SimpleUploadedFile('large.csv', b'x' * (MAX_FILE_BYTES + 1))
        with patch('groups.importer.extract_students') as parse:
            response = self.client.post(self.url, {'file': file, 'group_id': self.group.pk}, format='multipart')
        self.assertEqual(response.status_code, 400)
        parse.assert_not_called()

    def test_invalid_confirmation_shape_rejected_before_any_writes(self):
        for rows in [[], {}, [{'full_name': 'Ali', 'phone': '901234567'}, None], [{}] * (MAX_ROWS + 1)]:
            self.assertEqual(self.confirm(rows).status_code, 400)
        self.assertFalse(Student.objects.exists())

    def test_real_xlsx_upload(self):
        file = SimpleUploadedFile('students.xlsx', xlsx_bytes([['F.I.SH', 'Telefon'], ['Ali Vali', 901234567]]))
        response = self.client.post(self.url, {'file': file, 'group_id': self.group.pk}, format='multipart')
        self.assertEqual(response.data['created_count'], 1, response.data)

    def test_image_upload_reports_missing_ocr_as_service_error(self):
        output = io.BytesIO()
        Image.new('RGB', (20, 20)).save(output, format='PNG')
        file = SimpleUploadedFile('students.png', output.getvalue(), content_type='image/png')
        with patch('groups.importer.resolve_ocr_command', side_effect=OCRUnavailable()):
            response = self.client.post(self.url, {'file': file, 'group_id': self.group.pk,
                                                 'mode': 'preview'}, format='multipart')
        self.assertEqual(response.status_code, 503, response.data)
        self.assertEqual(response.data['detail'].code, 'ocr_unavailable')
        self.assertFalse(Student.objects.exists())

    @skipUnless(os.name == 'nt' and (Path(settings.BASE_DIR) / '.tools/tesseract/tesseract.exe').is_file(),
                'Requires project-local Windows Tesseract')
    @override_settings(STUDENT_OCR_COMMAND='tesseract')
    def test_real_image_upload_with_stale_command_setting(self):
        image = Image.new('RGB', (2300, 240), 'white')
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 40)
        draw = ImageDraw.Draw(image)
        for y, serial, phone, name, parent in [
            (40, '1', '+998 90 123 45 67', 'Abdullayev Sardor', '+998 94 111 22 33'),
            (120, '2', '+998 93 765 43 21', 'Karimova Madina', '+998 95 444 55 66'),
        ]:
            for x, value in [(40, serial), (160, phone), (680, name), (1500, parent)]:
                draw.text((x, y), value, fill='black', font=font)
        output = io.BytesIO()
        image.save(output, format='PNG')
        file = SimpleUploadedFile('students.png', output.getvalue(), content_type='image/png')
        response = self.client.post(self.url, {'file': file, 'group_id': self.group.pk,
                                             'mode': 'preview'}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data['students']
        self.assertEqual([r['phone'] for r in rows], ['+998901234567', '+998937654321'])
        self.assertEqual([r['full_name'] for r in rows], ['Abdullayev Sardor', 'Karimova Madina'])
        self.assertEqual([r['parent_phone'] for r in rows], ['+998941112233', '+998954445566'])
        self.assertFalse(Student.objects.exists())
        saved = self.confirm(rows)
        self.assertEqual(saved.data['created_count'], 2, saved.data)
        self.assertEqual(set(Student.objects.values_list('parent_phone', flat=True)), {'941112233', '954445566'})

    def test_image_upload_preview_and_confirm(self):
        output = io.BytesIO(); Image.new('RGB', (800, 200), 'white').save(output, format='PNG')
        file = SimpleUploadedFile('students.png', output.getvalue(), content_type='image/png')
        with patch('groups.importer._ocr_lines', return_value=['1 Ali Vali +998 90 123 45 67']):
            response = self.client.post(self.url, {'file': file, 'group_id': self.group.pk, 'mode': 'preview'}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(Student.objects.exists())
        self.assertEqual(self.confirm(response.data['students']).data['created_count'], 1)


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL advisory locks')
class ConcurrentImportTests(TransactionTestCase):
    def test_simultaneous_imports_create_one_student_and_one_invoice(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from types import SimpleNamespace
        from groups.importer import import_student_rows
        branch = Branch.objects.create(name='Concurrent import')
        group = Group.objects.create(name='Concurrent import', branch=branch, monthly_price=500000)
        user = get_user_model().objects.create_user(username='parallel_import', role='admin', branch=branch)
        barrier = Barrier(2)

        def worker():
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                return import_student_rows([{'full_name': 'Ali Vali', 'phone': '901234567'}],
                                           branch, group, SimpleNamespace(user=user))
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(worker) for _ in range(2)]
            results = [future.result(timeout=15) for future in futures]
        self.assertTrue(all(result['success'] for result in results), results)
        self.assertEqual(sum(result['created_count'] for result in results), 1)
        self.assertEqual(Student.objects.count(), 1)
        self.assertEqual(GroupEnrollment.objects.count(), 1)
        self.assertEqual(Payment.objects.count(), 1)

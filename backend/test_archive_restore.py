"""
Guruh arxivlash va tiklash jarayonini test qilish skripti.
Run: venv\Scripts\python manage.py runscript test_archive_restore
yoki: venv\Scripts\python -c "exec(open('test_archive_restore.py').read())"
"""
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from groups.models import Group, GroupEnrollment, Student
from archivebase.models import ArchivedGroup, ArchivedStudent
from archivebase.services import move_group_to_archive, restore_group_from_archive
from django.contrib.auth import get_user_model
User = get_user_model()

user = User.objects.filter(role='super_admin').first()
print("User:", user)

group = Group.objects.filter(is_archived=False).first()
if not group:
    print("No active groups found!")
else:
    print(f"\nGroup: {group.name} (ID={group.id})")
    students = list(group.students.all())
    print(f"Students in group ({len(students)}):")
    for s in students:
        print(f"  - {s.full_name} (ID={s.id})")

    print("\n=== ARCHIVING GROUP ===")
    archived = move_group_to_archive(group, user, reason='test')
    print(f"ArchivedGroup created: ID={archived.id}")
    meta = archived.metadata
    print(f"archived_student_ids in metadata: {meta.get('archived_student_ids')}")
    print(f"ArchivedStudent count now: {ArchivedStudent.objects.count()}")
    for ars in ArchivedStudent.objects.all():
        print(f"  ArchivedStudent: {ars.full_name} | original_id={ars.original_id} | id={ars.id}")

    print("\n=== RESTORING GROUP ===")
    result = restore_group_from_archive(archived.id, user)
    print(f"Restored group: {result['group'].name} (ID={result['group'].id})")
    print(f"Restored students: {result['restored_students']}")
    print(f"Skipped students: {result['skipped_students']}")
    print(f"Errors: {result['errors']}")

    new_group = result['group']
    students_after = list(new_group.students.all())
    print(f"Students in restored group ({len(students_after)}):")
    for s in students_after:
        print(f"  - {s.full_name} (ID={s.id})")

    print("\nTest complete — cleaning up")
    new_group.delete()

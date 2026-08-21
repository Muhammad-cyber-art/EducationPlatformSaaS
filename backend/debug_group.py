import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from groups.models import Group, Student

group_name = 'MATEM TEMUR DOMLA JUFT'
g = Group.objects.filter(name=group_name).first()

if not g:
    print(f"Group '{group_name}' not found.")
else:
    print(f"Group: {g.name} (ID: {g.id})")
    print(f"Branch: {g.branch.name if g.branch else 'None'}")
    
    students_m2m = g.students.all()
    print(f"M2M Students count: {students_m2m.count()}")
    for s in students_m2m:
        print(f"  - M2M: {s.full_name} (ID: {s.id})")
        
    students_fk = g.old_students_fk.all()
    print(f"FK Students count: {students_fk.count()}")
    for s in students_fk:
        print(f"  - FK: {s.full_name} (ID: {s.id})")
        
    from groups.models import GroupEnrollment
    enrollments = GroupEnrollment.objects.filter(group=g)
    print(f"Enrollments count: {enrollments.count()}")
    for e in enrollments:
        print(f"  - Enrollment: {e.student.full_name} (ID: {e.student.id}, Active: {e.is_active})")

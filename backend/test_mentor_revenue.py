from finance.utils import calculate_group_revenue_and_mentor_share
from groups.models import Group
from django.contrib.auth import get_user_model
from archivebase.models import ArchivedStudent
import datetime

User = get_user_model()

# Find a group that has archived students with payments
arch = ArchivedStudent.objects.exclude(metadata__payments=[]).last()
if not arch:
    print("No archived students with payments.")
else:
    payment_meta = arch.metadata['payments'][0]
    group_id = payment_meta.get('group')
    group = Group.objects.filter(id=group_id).first()
    if group:
        month_str = payment_meta.get('month', '')
        # Usually month is YYYY-MM-DD
        if month_str:
            year, month = map(int, month_str.split('-')[:2])
            month_date = datetime.date(year, month, 1)
            
            # calculate
            profile = group.mentor.staff_profile if group.mentor else None
            res = calculate_group_revenue_and_mentor_share(group, month_date, profile)
            
            print(f"Group: {group.name}, Month: {month_date}")
            print(f"Total Actual Revenue: {res['actual_revenue']}")
            print(f"Mentor Share Paid: {res['mentor_share_paid']}")
            
            # Check if archived student is in paid_students
            found = False
            for p in res['paid_students']:
                if 'archived' in str(p.get('id', '')):
                    print(f"Found archived student: {p['name']} - Amount: {p['paid_amount']} - Status: {p['status']} - Method: {p['payment_method']}")
                    found = True
            
            if not found:
                print("Archived student NOT found in paid_students!")
    else:
        print("Group not found.")

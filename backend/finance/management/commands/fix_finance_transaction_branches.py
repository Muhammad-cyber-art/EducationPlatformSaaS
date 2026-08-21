
from django.core.management.base import BaseCommand
from finance.models import FinanceTransaction
from groups.models import Student, Group


class Command(BaseCommand):
    help = "Fixes FinanceTransaction records with branch=None by using student's branch or group's branch"

    def handle(self, *args, **options):
        self.stdout.write("Starting to fix FinanceTransaction branches...")

        transactions = FinanceTransaction.objects.filter(branch__isnull=True)
        fixed_count = 0

        for tx in transactions:
            branch = None

            if tx.student and tx.student.branch:
                branch = tx.student.branch
            elif tx.group and tx.group.branch:
                branch = tx.group.branch

            if branch:
                tx.branch = branch
                tx.save()
                fixed_count += 1
                self.stdout.write(f"Fixed transaction {tx.id}: set branch to {branch.name}")
            else:
                self.stdout.write(f"Could not fix transaction {tx.id}: no branch found for student/group")

        self.stdout.write(self.style.SUCCESS(f"Successfully fixed {fixed_count} transactions!"))

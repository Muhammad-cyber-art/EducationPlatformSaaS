"""Shared object scopes for HTTP endpoints, exports and offline mutations."""
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied


def allowed_branch_ids(user):
    ids = set(user.branch_accesses.values_list('branch_id', flat=True))
    if user.branch_id:
        ids.add(user.branch_id)
    return ids


def require_finance_access(user, branch_id):
    if user.role == 'super_admin':
        return
    if user.role != 'admin' or branch_id not in allowed_branch_ids(user):
        raise PermissionDenied("Ushbu filial moliyasiga ruxsat yo'q.")


def accessible_groups(user):
    from groups.models import Group
    qs = Group.objects.all()
    if user.role == 'super_admin':
        return qs
    if user.role == 'admin':
        return qs.filter(branch_id__in=allowed_branch_ids(user))
    if user.role == 'mentor':
        return qs.filter(Q(mentor=user) | Q(additional_mentors__mentor=user)).distinct()
    return qs.none()


def scope_report(queryset, user, branch_field='group__branch_id'):
    if user.role == 'super_admin':
        return queryset
    if user.role == 'admin':
        return queryset.filter(**{f'{branch_field}__in': allowed_branch_ids(user)})
    return queryset.none()

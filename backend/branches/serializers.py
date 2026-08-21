# branches/serializers.py
from rest_framework import serializers
from .models import Branch
from django.contrib.auth import get_user_model

User = get_user_model()

class BranchSerializer(serializers.ModelSerializer):
    mentors_count = serializers.SerializerMethodField()
    admins_count = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()
    groups_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Branch
        fields = [
            'id',  'color',
            'name', 
            'address', 
            'mentors_count',
            'admins_count',
            'students_count',
            'groups_count'
        ]
    
    def get_mentors_count(self, obj) -> int:
        try:
            return User.objects.filter(branch=obj, role='mentor', is_active=True).count()
        except Exception:
            return 0
    
    def get_admins_count(self, obj) -> int:
        try:
            return User.objects.filter(branch=obj, role='admin', is_active=True).count()
        except Exception:
            return 0
    
    def get_students_count(self, obj) -> int:
        try:
            from groups.models import GroupEnrollment
            return GroupEnrollment.objects.filter(
                is_active=True,
                group__branch=obj,
                group__is_faol=True
            ).values('student_id').distinct().count()
        except Exception:
            return 0
    
    def get_groups_count(self, obj) -> int:
        try:
            from groups.models import Group
            return Group.objects.filter(branch=obj, is_faol=True).count()
        except Exception:
            return 0
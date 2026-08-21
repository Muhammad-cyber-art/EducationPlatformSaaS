from rest_framework import serializers
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from .models import Homework, HomeworkSubmission ,Attendance, MockTest, MockTestResult
# 1. O'quvchilar ro'yxati uchun (Detail sahifada ko'rinadi)
class HomeworkSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_student_name(self, obj):
        """Student o'chirilgan yoki null bo'lsa snapshot ismini qaytaradi."""
        if obj.student:
            return obj.student.full_name
        # SET_NULL holatida model ichidagi snapshot maydoni ishlatiladi
        return obj.student_full_name or "Noma'lum o'quvchi"

    class Meta:
        model = HomeworkSubmission
        fields = ('id', 'student_name', 'status', 'submitted_at')

# 2. Faqat statusni yangilash uchun (Patch so'rovida ishlatiladi)
class HomeworkSubmissionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomeworkSubmission
        fields = ('status',)

    def update(self, instance, validated_data):
        instance.status = validated_data.get('status', instance.status)
        if instance.status == 'not_submitted':
            instance.submitted_at = None
        else:
            instance.submitted_at = timezone.now()
        instance.save()
        return instance

# 3. Guruh sahifasidagi ro'yxat uchun (Ixcham variant)
class HomeworkListSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Homework
        # 'group' bu yerda ID raqamini bildiradi (masalan: 1)
        # 'group_name' esa faqat o'qish uchun guruh nomini bildiradi
        fields = ('id', 'title', 'description', 'group', 'group_name', 'stats', 'created_at')
        
    from drf_spectacular.utils import extend_schema_field
    @extend_schema_field(serializers.DictField())
    def get_stats(self, obj) -> dict:
        return {
            "total": obj.submissions.count(),
            "completed": obj.submissions.filter(status='full').count()
        }
# 4. Vazifa ustiga bosilganda chiqadigan sahifa uchun (To'liq variant)
class HomeworkDetailSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    # BUG FIX: Faqat guruhda FAOL bo'lgan o'quvchilar ko'rsatiladi.
    # Avval barcha submission'lar (unenrolled o'quvchilar ham) qaytarilar edi —
    # bu frontend'da null student_name crash'ga olib kelar edi.
    students_status = serializers.SerializerMethodField()

    @extend_schema_field(HomeworkSubmissionSerializer(many=True))
    def get_students_status(self, obj):
        from groups.models import GroupEnrollment
        active_student_ids = set(
            GroupEnrollment.objects.filter(
                group=obj.group,
                is_active=True
            ).values_list('student_id', flat=True)
        )
        submissions = obj.submissions.filter(
            student_id__in=active_student_ids
        ).select_related('student')
        return HomeworkSubmissionSerializer(submissions, many=True).data

    class Meta:
        model = Homework
        fields = ('id', 'title', 'description', 'group_name', 'students_status', 'created_at')

class MockTestResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    
    class Meta:
        model = MockTestResult
        fields = ('id', 'student_name', 'score', 'created_at')

class MockTestListSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    stats = serializers.SerializerMethodField()

    class Meta:
        model = MockTest
        fields = ('id', 'subject', 'type', 'group', 'group_name', 'date', 'stats', 'created_at')
        
    @extend_schema_field(serializers.DictField())
    def get_stats(self, obj) -> dict:
        # Oddiy statistika: nechta o'quvchi baholangan
        return {
            "total": obj.results.count(),
            "graded": obj.results.exclude(score='').count()
        }

class MockTestDetailSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    students_status = MockTestResultSerializer(source='results', many=True, read_only=True)

    class Meta:
        model = MockTest
        fields = ('id', 'subject', 'type', 'group_name', 'date', 'students_status', 'created_at')

class MockTestResultUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MockTestResult
        fields = ('score',)

# ========================== ATTENDS =====================================

# attends/serializers.py
# attends/serializers.py
from rest_framework import serializers
from .models import Attendance
from groups.models import Student
from django.utils import timezone


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    
    class Meta:
        model = Attendance
        fields = ['id', 'student_id', 'student_name', 'date', 'is_present', 'updated_at', 'marked_by']
        read_only_fields = ['id', 'student_id', 'date', 'updated_at', 'marked_by']
        
class AttendanceBulkMarkSerializer(serializers.Serializer):
    """Bir nechta studentni birdaniga belgilash uchun"""
    student_id = serializers.IntegerField()
    is_present = serializers.BooleanField()

class AttendanceEditSerializer(serializers.Serializer):
    """Oxirgi 3 ta dars davomatini o'zgartirish uchun"""
    new_status = serializers.BooleanField()
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
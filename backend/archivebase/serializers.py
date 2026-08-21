from rest_framework import serializers
from .models import ArchivedStudent, ArchivedStaff, ArchivedGroup, ArchivedLid

class ArchivedStudentSerializer(serializers.ModelSerializer):
    archived_by_name = serializers.ReadOnlyField(source='archived_by.username')

    class Meta:
        model = ArchivedStudent
        fields = '__all__'

class ArchivedLidSerializer(serializers.ModelSerializer):
    archived_by_name = serializers.ReadOnlyField(source='archived_by.username')

    class Meta:
        model = ArchivedLid
        fields = '__all__'

class ArchivedStaffSerializer(serializers.ModelSerializer):
    archived_by_name = serializers.ReadOnlyField(source='archived_by.username')

    class Meta:
        model = ArchivedStaff
        fields = '__all__'

class ArchivedGroupSerializer(serializers.ModelSerializer):
    archived_by_name = serializers.ReadOnlyField(source='archived_by.username')

    class Meta:
        model = ArchivedGroup
        fields = '__all__'

from .models import PaymentArchive, ArchivedHomework
class PaymentArchiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentArchive
        fields = '__all__'

class ArchivedHomeworkSerializer(serializers.ModelSerializer):
    archived_by_name = serializers.ReadOnlyField(source='archived_by.username')
    class Meta:
        model = ArchivedHomework
        fields = '__all__'

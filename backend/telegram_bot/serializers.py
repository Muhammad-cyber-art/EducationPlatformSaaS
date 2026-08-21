from rest_framework import serializers

class BotStatsSerializer(serializers.Serializer):
    students_bot_count = serializers.IntegerField()
    parents_bot_count = serializers.IntegerField()
    total_bot_users = serializers.IntegerField()
    unregistered_students = serializers.IntegerField()

class BroadcastMessageSerializer(serializers.Serializer):
    group_id = serializers.IntegerField(required=False)
    branch_id = serializers.IntegerField(required=False)
    send_to_all_branches = serializers.BooleanField(default=False)
    message = serializers.CharField()
    target_audience = serializers.ChoiceField(
        choices=[('active_students', 'Active Students'), ('waiting_students', 'Waiting Students'), ('archived_students', 'Archived Students')],
        default='active_students',
        required=False
    )

class BotSuccessSerializer(serializers.Serializer):
    success = serializers.BooleanField(default=True)
    message = serializers.CharField(required=False)

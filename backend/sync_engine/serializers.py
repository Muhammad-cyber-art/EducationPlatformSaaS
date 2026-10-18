from rest_framework import serializers
from .models import ClientLead


class ClientLeadSerializer(serializers.ModelSerializer):
    """
    ClientLead obyektini to'liq JSON formatiga o'tkazish.
    UUID va vaqt tamg'alari client va server orasida o'zgarmas saqlanadi.
    """
    class Meta:
        model = ClientLead
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'status',
            'notes',
            'assigned_to',
            'created_at',
            'updated_at',
            'is_deleted'
        ]
        read_only_fields = ['created_at']


class SyncMutationItemSerializer(serializers.Serializer):
    """
    Klient outbox navbatidagi bitta o'zgarish amali
    """
    queue_id = serializers.CharField(max_length=128, help_text="Mijoz DBsidagi navbat identifikatori")
    action = serializers.ChoiceField(choices=['create', 'update', 'delete', 'confirm'])
    entity = serializers.CharField(max_length=64)
    data = serializers.DictField(help_text="Obyektning o'zgargan maydonlari")
    client_timestamp = serializers.DateTimeField(required=False)


class SyncPushRequestSerializer(serializers.Serializer):
    """
    Klientdan serverga yuboriladigan paketli mutatsiyalar
    """
    mutations = serializers.ListField(
        child=SyncMutationItemSerializer(),
        allow_empty=True
    )


class SyncPullResponseSerializer(serializers.Serializer):
    """
    Serverdan klientga yuboriladigan ma'lumotlar oqimi
    """
    items = ClientLeadSerializer(many=True)
    has_more = serializers.BooleanField()
    next_cursor = serializers.CharField(allow_null=True)
    server_time = serializers.DateTimeField()
    total_count = serializers.IntegerField()

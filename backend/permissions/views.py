from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from .models import AdminAccess, StaffPermission
from .serializers import AdminAccessSerializer, StaffPermissionSerializer
from .permissions import IsSuperAdmin

User = get_user_model()

class StaffPermissionViewSet(viewsets.ModelViewSet):
    """
    Xodimlar ruxsatlarini boshqarish uchun to'liq ViewSet.
    
    Bu yerda siz:
    - Barcha xodimlar ruxsatlarini ko'rishingiz (list)
    - Bitta xodim ruxsatini ko'rishingiz (retrieve)
    - Ruxsatlarni o'zgartirishingiz (update/partial_update)
    - Yangi ruxsat yaratishingiz (create) mumkin.
    
    Lookup field sifatida 'user_id' ishlatiladi, shuning uchun URL da ID yoziladi.
    """
    queryset = StaffPermission.objects.all()
    serializer_class = StaffPermissionSerializer
    permission_classes = [IsSuperAdmin]
    lookup_field = 'user_id'

    def get_object(self):
        """
        Agar xodim uchun ruxsat obyekti hali yaratilmagan bo'lsa,
        uni avtomatik yaratib berish logikasi (Retrieve/Update vaqtida).
        """
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        user_id = self.kwargs.get(lookup_url_kwarg)

        # Odatdagi get_object urunib ko'radi
        try:
            obj = queryset.get(user_id=user_id)
        except StaffPermission.DoesNotExist:
            # Agar topilmasa, user borligini tekshiramiz va yangi permissions obyekti ochamiz
            user = get_object_or_404(User, id=user_id)
            obj = StaffPermission.objects.create(user=user)
        
        self.check_object_permissions(self.request, obj)
        return obj
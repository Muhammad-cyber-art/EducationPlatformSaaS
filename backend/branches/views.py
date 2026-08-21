from rest_framework import viewsets
from .models import Branch
from .serializers import BranchSerializer
from .permissions import IsSuperAdminOnly  # Biz yozgan qat'iy permission
from rest_framework.permissions import IsAuthenticated
class BranchViewSet(viewsets.ModelViewSet):
    # Super Admin hammasini ko'rishi kerak, shuning uchun oddiy queryset yetarli
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
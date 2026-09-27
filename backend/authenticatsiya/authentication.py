"""
Tenant-aware JWT Authentication.

SimpleJWT ning standart JWTAuthentication klassidan meros oladi va quyidagilarni kafolatlaydi:
1. Standart token validatsiyasi (imzo, muddat va h.k.)
2. Cross-Tenant Token Replay himoyasi:
   - Tokendagi 'tenant_schema' joriy so'rovning faol tenant schemasi bilan mos kelishi shart.
   - Agar biror foydalanuvchi A markazning tokeni bilan B markazning domeniga kelsa,
     avtomatik ravishda 401 Unauthorized bilan to'xtatiladi.
3. CEO userlar uchun: agar so'rov CEO so'rovi bo'lsa (is_ceo_request), bu auth klassi
   aralashmaydi (CEO alohida CEOJWTAuthentication ishlatadi).
"""

import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

from tenants.context import get_current_tenant

logger = logging.getLogger(__name__)


class TenantJWTAuthentication(JWTAuthentication):
    """
    Tenant-aware JWT Authentication klassi.
    
    JWT token payloadida 'tenant_schema' mavjudligini va joriy request.tenant
    bilan to'liq mos kelishini tekshiradi.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token

    def get_user(self, validated_token):
        user = super().get_user(validated_token)

        current_tenant = get_current_tenant()
        token_schema = validated_token.get('tenant_schema')

        # Agar so'rov tenant kontekstida ishlayotgan bo'lsa (TenantMiddleware tomonidan o'rnatilgan)
        if current_tenant:
            current_schema = getattr(current_tenant, 'schema_name', None)
            
            # 1. Tokenda tenant_schema bo'lishi shart
            if not token_schema:
                logger.warning(
                    "Tenant kontekstida tenant_schema'siz token ishlatildi: user=%s, current_schema=%s",
                    user.username, current_schema
                )
                raise AuthenticationFailed(
                    "Token yaroqsiz: o'quv markaz ma'lumotlari topilmadi. Qayta kiring.",
                    code="missing_tenant_token"
                )

            # 2. Tokendagi schema joriy tenant schemasiga teng bo'lishi shart
            if token_schema != current_schema:
                logger.warning(
                    "Cross-tenant token replay aniqlandi! user=%s, token_schema=%s, current_schema=%s",
                    user.username, token_schema, current_schema
                )
                raise AuthenticationFailed(
                    "Ushbu token boshqa o'quv markaziga tegishli. O'z markazingiz orqali kiring.",
                    code="cross_tenant_token_forbidden"
                )

        return user

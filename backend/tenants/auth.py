"""
CEO JWT Token utilities.

CEOUser Django AbstractUser bilan bog'liq emas, shuning uchun
standard SimpleJWT ishlatilmaydi. Bu modul CEOUser uchun
alohida JWT token yaratish va tekshirish funksiyalarini ta'minlaydi.

Tokenlar standart JWT formatda, lekin payload da 'ceo': True flag bor.
Bu tenant JWT tokenlaridan ajratib olish imkonini beradi.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

try:
    import jwt as pyjwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False

from tenants.models import CEOUser

logger = logging.getLogger(__name__)

# Token muddatlari
CEO_ACCESS_TOKEN_LIFETIME  = timedelta(hours=8)
CEO_REFRESH_TOKEN_LIFETIME = timedelta(days=30)

# JWT algorithm
_ALGORITHM = "HS256"


def _get_secret() -> str:
    return settings.SECRET_KEY


def generate_ceo_tokens(ceo_user: CEOUser) -> dict:
    """
    CEOUser uchun access va refresh tokenlar yaratadi.

    Returns:
        {"access": str, "refresh": str, "expires_in": int (seconds)}
    """
    if not HAS_JWT:
        raise RuntimeError("PyJWT o'rnatilmagan. requirements.txt ga PyJWT qo'shing.")

    now = timezone.now()
    secret = _get_secret()

    access_payload = {
        "type":     "ceo_access",
        "ceo":      True,
        "sub":      str(ceo_user.id),
        "email":    ceo_user.email,
        "iat":      int(now.timestamp()),
        "exp":      int((now + CEO_ACCESS_TOKEN_LIFETIME).timestamp()),
    }

    refresh_payload = {
        "type":     "ceo_refresh",
        "ceo":      True,
        "sub":      str(ceo_user.id),
        "iat":      int(now.timestamp()),
        "exp":      int((now + CEO_REFRESH_TOKEN_LIFETIME).timestamp()),
    }

    access_token  = pyjwt.encode(access_payload,  secret, algorithm=_ALGORITHM)
    refresh_token = pyjwt.encode(refresh_payload, secret, algorithm=_ALGORITHM)

    # Last login yangilash
    ceo_user.last_login = now
    ceo_user.save(update_fields=["last_login"])

    return {
        "access":     access_token,
        "refresh":    refresh_token,
        "token_type": "Bearer",
        "expires_in": int(CEO_ACCESS_TOKEN_LIFETIME.total_seconds()),
    }


def decode_ceo_token(token: str) -> dict:
    """
    CEO access tokenni decode qiladi va payload qaytaradi.

    Raises:
        AuthenticationFailed: Token noto'g'ri, muddati tugagan yoki CEO emas
    """
    if not HAS_JWT:
        raise RuntimeError("PyJWT o'rnatilmagan.")

    try:
        payload = pyjwt.decode(token, _get_secret(), algorithms=[_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise AuthenticationFailed("CEO token muddati tugagan. Qayta kiring.")
    except pyjwt.InvalidTokenError as exc:
        raise AuthenticationFailed(f"Noto'g'ri CEO token: {exc}")

    if not payload.get("ceo"):
        raise AuthenticationFailed("Bu token CEO tokeni emas.")

    if payload.get("type") != "ceo_access":
        raise AuthenticationFailed("Refresh token access sifatida ishlatildi.")

    return payload


def refresh_ceo_token(refresh_token: str) -> dict:
    """
    Refresh token bilan yangi access token oladi.

    Returns:
        {"access": str, "expires_in": int}
    """
    if not HAS_JWT:
        raise RuntimeError("PyJWT o'rnatilmagan.")

    try:
        payload = pyjwt.decode(refresh_token, _get_secret(), algorithms=[_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise AuthenticationFailed("Refresh token muddati tugagan. Qayta kiring.")
    except pyjwt.InvalidTokenError as exc:
        raise AuthenticationFailed(f"Noto'g'ri refresh token: {exc}")

    if payload.get("type") != "ceo_refresh":
        raise AuthenticationFailed("Bu token refresh token emas.")

    try:
        ceo_user = CEOUser.objects.get(id=int(payload["sub"]), is_active=True)
    except CEOUser.DoesNotExist:
        raise AuthenticationFailed("CEO foydalanuvchi topilmadi yoki faol emas.")

    # Yangi access token
    now = timezone.now()
    new_payload = {
        "type":  "ceo_access",
        "ceo":   True,
        "sub":   str(ceo_user.id),
        "email": ceo_user.email,
        "iat":   int(now.timestamp()),
        "exp":   int((now + CEO_ACCESS_TOKEN_LIFETIME).timestamp()),
    }
    new_access = pyjwt.encode(new_payload, _get_secret(), algorithm=_ALGORITHM)

    return {
        "access":     new_access,
        "token_type": "Bearer",
        "expires_in": int(CEO_ACCESS_TOKEN_LIFETIME.total_seconds()),
    }


# ─────────────────────────────────────────────────────────────────────────────
# DRF AUTHENTICATION CLASS
# ─────────────────────────────────────────────────────────────────────────────

class CEOJWTAuthentication(BaseAuthentication):
    """
    DRF Authentication class CEO API views uchun.

    CEO views da ishlatish:
        class TenantListView(APIView):
            authentication_classes = [CEOJWTAuthentication]
            permission_classes     = [IsCEOAuthenticated]
    """

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")

        if not auth_header.startswith("Bearer "):
            return None  # Boshqa authenticatorga qoldirish

        token = auth_header[len("Bearer "):]

        try:
            payload  = decode_ceo_token(token)
            ceo_user = CEOUser.objects.get(id=int(payload["sub"]), is_active=True)
        except CEOUser.DoesNotExist:
            raise AuthenticationFailed("CEO foydalanuvchi topilmadi.")
        except AuthenticationFailed:
            raise
        except Exception as exc:
            logger.warning("CEO auth xatolik: %s", exc)
            raise AuthenticationFailed("Autentifikatsiya muvaffaqiyatsiz.")

        return (ceo_user, token)

    def authenticate_header(self, request):
        return 'Bearer realm="CEO API"'


# ─────────────────────────────────────────────────────────────────────────────
# DRF PERMISSION CLASS
# ─────────────────────────────────────────────────────────────────────────────

class IsCEOAuthenticated:
    """
    DRF Permission — faqat autentifikatsiyalangan CEOUser uchun.

    Ishlatish:
        permission_classes = [IsCEOAuthenticated]
    """
    from rest_framework.permissions import BasePermission

    class _Perm(BasePermission):
        def has_permission(self, request, view):
            return (
                request.user is not None
                and isinstance(request.user, CEOUser)
                and request.user.is_active
            )

    # Class-level attribute sifatida ishlatilishi uchun
    def __class_getitem__(cls, item):
        return cls._Perm


# Tayyor import qilish uchun
from rest_framework.permissions import BasePermission as _BP


class IsCEOPermission(_BP):
    """Faqat CEOUser foydalanuvchilar uchun ruxsat."""

    def has_permission(self, request, view):
        return (
            hasattr(request, "user")
            and isinstance(request.user, CEOUser)
            and request.user.is_active
        )

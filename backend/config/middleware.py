"""
Custom middleware for additional security and logging
"""
import logging
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Qo'shimcha xavfsizlik headerlarini qo'shish
    """
    def process_response(self, request, response):
        # XSS himoyasi
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer Policy
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions Policy (eski Feature-Policy)
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        
        return response


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Barcha so'rovlarni loglash (xavfsizlik audit uchun)
    """
    def process_request(self, request):
        # Faqat muhim so'rovlarni log qilamiz
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            logger.info(
                f"Request: {request.method} {request.path} | "
                f"User: {request.user if request.user.is_authenticated else 'Anonymous'} | "
                f"IP: {self.get_client_ip(request)}"
            )
        return None
    
    def process_response(self, request, response):
        # Xatolarni log qilish
        if response.status_code >= 400:
            logger.warning(
                f"Response: {response.status_code} | "
                f"Path: {request.path} | "
                f"User: {request.user if request.user.is_authenticated else 'Anonymous'}"
            )
        return response
    
    @staticmethod
    def get_client_ip(request):
        """Client IP addressini olish"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class RateLimitMiddleware(MiddlewareMixin):
    """
    Taqsimlangan (distributed) Rate Limiting (DDoS va Brute-force himoyasi).
    Fixed-window atomik Redis hisoblagichi orqali ishlaydi (Workerlar orasida xavfsiz,
    thread-safe va har bir so'rovda timeout uzayib ketmaydi).
    """
    RATE_LIMIT = 15  # 1 daqiqada ruxsat etilgan maksimal urinishlar soni
    BLOCK_WINDOW = 60  # daqiqalik oyna (sekundlarda)

    def process_request(self, request):
        if '/login/' in request.path or '/register/' in request.path:
            ip = RequestLoggingMiddleware.get_client_ip(request)
            cache_key = f"ratelimit:{ip}:{request.path}"

            try:
                from django.core.cache import cache
                # Atomik ravishda birinchi so'rovda kalit yaratiladi va timeout belgilanadi.
                # Keyingi so'rovlarda timeout o'zgarmaydi (rolling window xatosi bartaraf etildi).
                is_new_window = cache.add(cache_key, 1, timeout=self.BLOCK_WINDOW)
                if not is_new_window:
                    try:
                        current_count = cache.incr(cache_key)
                    except (ValueError, Exception):
                        cache.set(cache_key, 1, timeout=self.BLOCK_WINDOW)
                        current_count = 1
                else:
                    current_count = 1

                if current_count > self.RATE_LIMIT:
                    logger.warning(f"Rate limit exceeded for IP: {ip} on {request.path} (count: {current_count})")
                    return JsonResponse(
                        {
                            'error': "Juda ko'p so'rov yuborildi. Iltimos, 1 daqiqa kuting.",
                            'code': 'RATE_LIMIT_EXCEEDED'
                        },
                        status=429
                    )
            except Exception as e:
                logger.debug(f"RateLimit cache fallback/warning: {e}")
                return None

        return None



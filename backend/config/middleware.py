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
    Oddiy rate limiting (DDoS himoyasi).
    Production uchun django-ratelimit yoki Redis ishlatish tavsiya etiladi.
    """
    request_counts = {}

    def process_request(self, request):
        if '/login/' in request.path or '/register/' in request.path:
            ip = RequestLoggingMiddleware.get_client_ip(request)

            import time
            current_time = int(time.time() / 60)
            key = f"{ip}_{current_time}"

            if key in self.request_counts:
                self.request_counts[key] += 1
                if self.request_counts[key] > 10:
                    logger.warning(f"Rate limit exceeded for IP: {ip}")
                    return JsonResponse(
                        {'error': "Juda ko'p so'rov. Iltimos, bir oz kuting."},
                        status=429
                    )
            else:
                self.request_counts[key] = 1

            # Eski keylarni tozalash (memory leak oldini olish)
            old_keys = [k for k in self.request_counts if not k.endswith(str(current_time))]
            for old_key in old_keys:
                del self.request_counts[old_key]

        return None

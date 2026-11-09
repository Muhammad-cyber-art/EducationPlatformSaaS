import logging
from django.utils import timezone
from rest_framework.pagination import PageNumberPagination

logger = logging.getLogger(__name__)

def _parse_month_year(query_params):
    """Parse and validate month/year query params with safe defaults."""
    today = timezone.localdate()
    raw_month = query_params.get('month', today.month)
    raw_year = query_params.get('year', today.year)

    try:
        month = int(raw_month)
        year = int(raw_year)
    except (TypeError, ValueError):
        raise ValueError("month va year raqam bo'lishi kerak")

    if not 1 <= month <= 12:
        raise ValueError("month 1 dan 12 gacha bo'lishi kerak")
    if not 2000 <= year <= 2100:
        raise ValueError("year noto'g'ri formatda")

    return month, year

# --- Pagination ---

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class HeavyResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


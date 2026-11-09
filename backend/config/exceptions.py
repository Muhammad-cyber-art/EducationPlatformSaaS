"""Keep unexpected API failures confined to their request and traceable in logs."""
import logging
import uuid

from django.db import InterfaceError, OperationalError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler, set_rollback

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response
    set_rollback()
    error_id = uuid.uuid4().hex
    unavailable = isinstance(exc, (OperationalError, InterfaceError))
    logger.error('API request failed: error_id=%s, view=%s', error_id,
                 type(context.get('view')).__name__, exc_info=(type(exc), exc, exc.__traceback__))
    response = Response({
        'detail': "Xizmat vaqtincha band. Keyinroq qayta urinib ko‘ring." if unavailable
                  else "Serverda xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.",
        'code': 'service_unavailable' if unavailable else 'internal_error',
        'error_id': error_id,
    }, status=503 if unavailable else 500)
    response['X-Error-ID'] = error_id
    if unavailable:
        response['Retry-After'] = '5'
    return response

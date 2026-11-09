"""Resolve OCR at request time so a running server can discover a local install."""
import logging
import os
from pathlib import Path
import shutil
from threading import BoundedSemaphore

from django.conf import settings
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)
# One image pipeline per web process; reject overload instead of queuing threads
# while decoded images and OCR subprocesses consume memory.
image_slot = BoundedSemaphore(1)


class OCRUnavailable(APIException):
    status_code = 503
    default_detail = "Rasmni o‘qish xizmati sozlanmagan. Administrator OCR sozlamalarini tekshirishi kerak."
    default_code = 'ocr_unavailable'


class OCRBusy(OCRUnavailable):
    default_detail = "Rasmni o‘qish xizmati band. Bir necha soniyadan keyin qayta urinib ko‘ring."
    default_code = 'ocr_busy'
    wait = 2


def resolve_ocr_command():
    configured = str(getattr(settings, 'STUDENT_OCR_COMMAND', '') or '').strip().strip('"')
    # Explicit custom executables must not silently fall back to another version.
    if configured and configured.lower() not in {'tesseract', 'tesseract.exe'}:
        candidates = [configured]
    else:
        candidates = [str(Path(settings.BASE_DIR) / '.tools' / 'tesseract' / 'tesseract.exe')]
        candidates.append(configured or 'tesseract')
        if os.name == 'nt':
            for variable in ('ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA'):
                root = os.environ.get(variable)
                if root:
                    candidates.append(str(Path(root) / 'Tesseract-OCR' / 'tesseract.exe'))
    for candidate in candidates:
        executable = shutil.which(candidate)
        if executable:
            return executable
    logger.error('Student OCR executable not found; configured=%r, candidates=%r', configured, candidates)
    raise OCRUnavailable()


def ocr_arguments(executable):
    languages = getattr(settings, 'STUDENT_OCR_LANGUAGES', 'eng+uzb+rus')
    arguments = ['-l', languages, '--psm', '6', '-c', 'preserve_interword_spaces=1']
    # Use the models packaged with a local executable, regardless of inherited
    # TESSDATA_PREFIX values or the server's working directory.
    data_dir = Path(executable).parent / 'tessdata'
    if data_dir.is_dir():
        missing = [language for language in languages.split('+')
                   if not (data_dir / f'{language}.traineddata').is_file()]
        if missing:
            logger.error('Student OCR language models missing in %s: %s', data_dir, missing)
            raise OCRUnavailable("Rasmni o‘qish uchun kerakli OCR til modellari o‘rnatilmagan.")
        arguments.extend(['--tessdata-dir', str(data_dir)])
    return arguments

"""
File upload validation utilities
"""
import os
from django.core.exceptions import ValidationError


def validate_image_file(file):
    """
    Rasm fayllarini validatsiya qilish
    """
    # Fayl hajmini tekshirish (maksimal 5MB)
    max_size = 5 * 1024 * 1024  # 5 MB
    if file.size > max_size:
        raise ValidationError(f"Fayl hajmi {max_size / (1024 * 1024)}MB dan oshmasligi kerak.")
    
    # Fayl kengaytmasini tekshirish
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    ext = os.path.splitext(file.name)[1].lower()
    
    if ext not in allowed_extensions:
        raise ValidationError(
            f"Faqat quyidagi formatlar ruxsat etilgan: {', '.join(allowed_extensions)}"
        )
    
    # MIME type tekshirish (qo'shimcha xavfsizlik)
    try:
        from PIL import Image
        image = Image.open(file)
        image.verify()
        
        # Ruxsat etilgan formatlar
        allowed_formats = ['JPEG', 'PNG', 'GIF', 'WEBP']
        if image.format not in allowed_formats:
            raise ValidationError("Noto'g'ri rasm formati.")
            
    except Exception as e:
        raise ValidationError(f"Fayl buzilgan yoki noto'g'ri format: {str(e)}")
    
    # File pointer'ni qayta boshiga qaytarish
    file.seek(0)
    
    return file


def validate_file_name(filename):
    """
    Fayl nomini xavfsiz qilish (path traversal hujumlaridan himoya)
    """
    # Xavfli belgilarni olib tashlash
    dangerous_chars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
    
    for char in dangerous_chars:
        if char in filename:
            raise ValidationError(f"Fayl nomida xavfli belgilar mavjud: {char}")
    
    return filename


def sanitize_filename(filename):
    """
    Fayl nomini tozalash va xavfsiz qilish
    """
    import re
    
    # Faqat harf, raqam, nuqta, tire va pastki chiziqqa ruxsat
    filename = re.sub(r'[^\w\s.-]', '', filename)
    
    # Ko'p bo'sh joylarni bitta bo'sh joyga almashtirish
    filename = re.sub(r'\s+', '_', filename)
    
    # Uzunlikni cheklash
    max_length = 100
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext
    
    return filename

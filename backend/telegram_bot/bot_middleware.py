import logging
from functools import wraps
from telegram import Update
from telegram.ext import ContextTypes
from asgiref.sync import sync_to_async
from .models import BotProfile

logger = logging.getLogger(__name__)

async def auth_middleware(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Bu funksiya har qanday handler (Message, CallbackQuery) ishlashidan oldin chaqiriladi
    (botning TypeHandler orqali).
    Foydalanuvchini identifikatsiya qiladi va uning roliga qarab context'ga yozadi.
    """
    if not update.effective_user:
        return
        
    user_id = str(update.effective_user.id)
    
    # Keshdan tekshirishni olib tashlaymiz (har safar bazadan eng yangi ma'lumotni olamiz).
    # Chunki PicklePersistence ishlatilganda eski keshdagi model aloqalari (ORM relations) asinxron muhitda xatolik beradi (SynchronousOnlyOperation).
    # Bazadan tortib olish (select_related orqali kerakli bog'liqliklar bilan)
    profile = await sync_to_async(
        lambda: BotProfile.objects.select_related('user__branch', 'student').filter(telegram_id=user_id, is_active=True).first()
    )()
    
    if profile:
        context.user_data['bot_profile'] = profile
        context.user_data['role'] = profile.role
    else:
        context.user_data.pop('bot_profile', None)
        context.user_data['role'] = 'guest'

def require_roles(*allowed_roles):
    """
    Rolga asoslangan dekorator. Har bir handler faqat tegishli rollar uchun ishlaydi.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
            # Agar auth_middleware to'g'ridan-to'g'ri ishlamagan bo'lsa (masalan CallbackQuery da), qo'lda chaqirib yuboramiz:
            if 'role' not in context.user_data:
                await auth_middleware(update, context)
                
            role = context.user_data.get('role', 'guest')
            
            if role not in allowed_roles:
                message = "⛔️ Kechirasiz, sizda bu bo'limga kirish huquqi yo'q."
                if update.callback_query:
                    await update.callback_query.answer(message, show_alert=True)
                elif update.message:
                    await update.message.reply_html(message)
                return
                
            return await func(update, context, *args, **kwargs)
        
        return wrapper
    return decorator

# Qisqartirilgan alias'lar
require_admin = require_roles('admin', 'super_admin')
require_super_admin = require_roles('super_admin')
require_student = require_roles('student')
require_teacher = require_roles('teacher')
require_auth = require_roles('admin', 'super_admin', 'student', 'teacher')

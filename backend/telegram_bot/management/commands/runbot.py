import logging
import re
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db.models import Q
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes, ConversationHandler, TypeHandler, PicklePersistence
from groups.models import Student
from authenticatsiya.models import UserModel
from telegram_bot.models import BotProfile
from asgiref.sync import sync_to_async
from telegram_bot.bot_middleware import auth_middleware, require_roles, require_admin, require_super_admin, require_student, require_auth

# Logging sozlash
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# BOT_TOKEN
TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')

# Conversation states
PHONE, CONFIRM = range(2)

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Xatoliklarni ushlash va logga yozish (bot o'chib qolmasligi uchun)"""
    logger.error(msg="Bot ishlashida xatolik yuz berdi:", exc_info=context.error)


class Command(BaseCommand):
    help = 'Telegram botni ishga tushirish (Barcha rollar uchun universal bot)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Bot ishga tushmoqda...'))
        print(">>> Bot polling rejimida ishga tushirildi...")
        
        if not TOKEN:
            self.stdout.write(self.style.ERROR('XATO: TELEGRAM_BOT_TOKEN settings.py da topilmadi!'))
            return

        persistence = PicklePersistence(filepath="bot_persistence.pickle")
        app = ApplicationBuilder().token(TOKEN).persistence(persistence).build()

        # TypeHandler barcha update'lardan oldin ishlashi uchun group=-1
        app.add_handler(TypeHandler(Update, auth_middleware), group=-1)

        # Conversation handler for authentication
        conv_handler = ConversationHandler(
            entry_points=[CommandHandler("start", start)],
            states={
                PHONE: [MessageHandler(filters.CONTACT, contact_handler)],
                CONFIRM: [MessageHandler(filters.TEXT & ~filters.COMMAND, confirm_handler)],
            },
            fallbacks=[CommandHandler("cancel", cancel)],
            name="auth_conversation",
            persistent=True,
            allow_reentry=True,
        )

        # Handlers
        app.add_handler(conv_handler)
        app.add_handler(CommandHandler("help", help_command))
        app.add_handler(CommandHandler("menu", show_main_menu))
        app.add_handler(CommandHandler("admin", admin_panel))
        app.add_handler(CallbackQueryHandler(button_callback))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))
        
        # Xatoliklarni ushlovchi handler
        app.add_error_handler(error_handler)

        self.stdout.write(self.style.SUCCESS('Bot muvaffaqiyatli ishga tushdi (Polling mode)'))
        app.run_polling()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start komandasi - ro'yxatdan o'tish jarayoni"""
    # Keshni tozalab bazadan yangi holatni tekshiramiz (masalan foydalanuvchi uzilgan bo'lsa)
    context.user_data.clear()
    await auth_middleware(update, context)
    
    role = context.user_data.get('role', 'guest')
    
    if role != 'guest':
        keyboard = [[KeyboardButton("Menyuga qaytish")]]
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
        await update.message.reply_html(
            "Tizimga kirgansiz. Menyudan foydalanishingiz mumkin.",
            reply_markup=reply_markup
        )
        await show_main_menu(update, context)
        return ConversationHandler.END
    
    # Ro'yxatdan o'tmagan bo'lsa, kontaktni so'rash
    keyboard = [[KeyboardButton("📞 Telefon raqamni yuborish", request_contact=True)]]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)
    
    await update.message.reply_html(
        f"<b>Assalomu alaykum!</b>\n\n"
        f"Ushbu bot orqali platformamizdan foydalanishingiz mumkin.\n"
        f"Botdan foydalanish uchun telefon raqamingizni yuboring:",
        reply_markup=reply_markup
    )
    
    return PHONE

@sync_to_async
def process_contact_and_create_profile(clean_phone, chat_id):
    """
    Telefon raqami bo'yicha UserModel va Student qidirish va BotProfile yaratish.
    """
    possible_numbers = {clean_phone}
    if clean_phone.startswith('998'):
        possible_numbers.add(clean_phone[3:])
    else:
        possible_numbers.add('998' + clean_phone)

    # 1. Admin/Super Admin qidirish
    for phone in possible_numbers:
        user = UserModel.objects.select_related('branch').filter(
            Q(phone_number=phone) | Q(phone_number__endswith=phone[-9:]),
            role__in=['admin', 'super_admin', 'teacher'],
            is_active=True
        ).first()
        if user:
            # Eski profillarni tozalash (xuddi shu chat_id bo'lsa o'chiramiz, boshqa odamniki bo'lishi mumkin)
            BotProfile.objects.filter(telegram_id=chat_id).exclude(user=user).delete()
            
            profile, created = BotProfile.objects.update_or_create(
                user=user,
                defaults={
                    'telegram_id': chat_id,
                    'phone_number': user.phone_number,
                    'role': user.role,
                    'is_active': True
                }
            )
            return profile, 'admin_confirm_needed'

    # 2. Student qidirish
    found_student_names = []
    student_profile_created = False
    profile = None
    
    for phone in possible_numbers:
        students = Student.objects.filter(
            Q(phone=phone) | Q(phone__endswith=phone[-9:]) | Q(parent_phone=phone) | Q(parent_phone__endswith=phone[-9:]),
            is_active=True
        )
        for student in students:
            # ✅ SENIOR FIX: Student modelini o'ziga ham telegram_id larni yozib qo'yish
            update_fields = []
            
            # Agar o'zining raqami mos kelsa
            if student.phone and (student.phone == phone or student.phone.endswith(phone[-9:])):
                if student.telegram_id != chat_id:
                    student.telegram_id = chat_id
                    update_fields.append('telegram_id')
            
            # Agar ota-onaning raqami mos kelsa
            if student.parent_phone and (student.parent_phone == phone or student.parent_phone.endswith(phone[-9:])):
                if student.parent_telegram_id != chat_id:
                    student.parent_telegram_id = chat_id
                    update_fields.append('parent_telegram_id')
                    
            if update_fields:
                student.save(update_fields=update_fields)

            if not student_profile_created:
                # Eski profillarni tozalash
                BotProfile.objects.filter(telegram_id=chat_id).exclude(student=student).delete()
                
                profile, created = BotProfile.objects.update_or_create(
                    student=student,
                    defaults={
                        'telegram_id': chat_id,
                        'phone_number': student.phone or student.parent_phone or phone,
                        'role': 'student',
                        'is_active': True
                    }
                )
                student_profile_created = True
            
            # Guruhlarni yig'ish
            active_groups = student.groups.filter(enrollments__is_active=True).distinct()
            if not active_groups and student.group:
                active_groups = [student.group]
            
            if not active_groups:
                found_student_names.append(f"{student.full_name.strip()} (Guruhsiz)")
            else:
                for group in active_groups:
                    found_student_names.append(f"{student.full_name.strip()} ({group.name})")

    if student_profile_created:
        return profile, found_student_names
    
    return None, None

async def contact_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Kontakt kelganda uni bazada qidirish (student va admin)"""
    contact = update.message.contact
    phone = contact.phone_number
    clean_phone = re.sub(r'\D', '', phone)
    chat_id = str(update.effective_chat.id)
    
    profile, result = await process_contact_and_create_profile(clean_phone, chat_id)
    
    if profile:
        context.user_data['bot_profile'] = profile
        context.user_data['role'] = profile.role
        
        if result == 'admin_confirm_needed':
            branch_name = profile.user.branch.name if profile.user.branch else 'Biriktirilmagan'
            await update.message.reply_html(
                f"✅ <b>Foydalanuvchi topildi!</b>\n\n"
                f"Ism: <b>{profile.get_full_name()}</b>\n"
                f"Rol: <b>{profile.get_role_display()}</b>\n"
                f"Filial: {branch_name}\n\n"
                f"Tasdiqlash uchun <b>HA</b> yozing, bekor qilish uchun <b>YO'Q</b>."
            )
            return CONFIRM
        else: # student
            student_names = ", ".join(list(set(result)))
            keyboard = [[KeyboardButton("Menyuga qaytish")]]
            reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
            await update.message.reply_html(
                f"✅ <b>Tasdiqlandi!</b>\n\n"
                f"Siz quyidagi o'quvchilar bilan bog'landingiz: <b>{student_names}</b>\n\n"
                f"ℹ️ <b>Ma'lumot:</b> Hozircha siz bot orqali faqatgina davomat, uy vazifalari va to'lovlar haqida xabarnomalar qabul qilasiz. O'zingiz botga so'rov yubora olmaysiz.",
                reply_markup=reply_markup
            )
            return ConversationHandler.END
    else:
        await update.message.reply_html(
            f"❌ <b>Kechirasiz!</b>\n\n"
            f"Tizimda <code>{phone}</code> raqami topilmadi.\n"
            f"Iltimos, markazga murojaat qilib, raqamingizni to'g'irlatib oling."
        )
        return ConversationHandler.END

async def confirm_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin tasdiqlash jarayoni"""
    text = update.message.text.strip().upper()
    
    if text == 'HA':
        profile = context.user_data.get('bot_profile')
        if profile:
            keyboard = [[KeyboardButton("Menyuga qaytish")]]
            reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
            await update.message.reply_html(
                f"✅ <b>Muvaffaqiyatli ro'yxatdan o'tdingiz!</b>\n\n"
                f"Assalomu alaykum, {profile.get_full_name()}!",
                reply_markup=reply_markup
            )
            await show_main_menu(update, context)
            logger.info(f"User {profile.get_full_name()} authenticated as {profile.role}")
        else:
            await update.message.reply_html("<b>❌ Xatolik!</b>\n\nSessiya tugadi. Qaytadan /start bosing.")
        return ConversationHandler.END
    
    elif text == 'YOQ':
        context.user_data.clear() # Sessiyani tozalash
        await update.message.reply_html(
            "<b>❌ Bekor qilindi.</b>\n\nQaytadan ro'yxatdan o'tish uchun /start bosing."
        )
        return ConversationHandler.END
    else:
        await update.message.reply_html("Iltimos, <b>HA</b> yoki <b>YO'Q</b> deb javob bering.")
        return CONFIRM

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bekor qilish"""
    context.user_data.clear()
    await update.message.reply_html(
        "<b>❌ Bekor qilindi.</b>\n\nQaytadan ro'yxatdan o'tish uchun /start bosing."
    )
    return ConversationHandler.END

@require_auth
async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Asosiy menuni ko'rsatish (rolga qarab)"""
    role = context.user_data.get('role')
    profile = context.user_data.get('bot_profile')
    
    if role in ['admin', 'super_admin']:
        keyboard = [
            [InlineKeyboardButton("📊 Kunlik Hisobot (Excel)", callback_data='daily_report')],
            [InlineKeyboardButton("👥 Guruh davomat hisoboti", callback_data='group_report_list')],
        ]
        if role == 'super_admin':
            keyboard.append([InlineKeyboardButton("💰 Moliyaviy Hisobot", callback_data='financial_report')])
        keyboard.append([InlineKeyboardButton("ℹ️ Yordam", callback_data='help')])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        branch_name = profile.user.branch.name if profile.user and profile.user.branch else 'Biriktirilmagan'
        
        text = (
            f"<b>👋 Assalomu alaykum, {profile.get_full_name()}!</b>\n\n"
            f"Rol: <b>{profile.get_role_display()}</b>\n"
            f"Filial: {branch_name}\n\n"
            f"<b>Admin Panel</b>dan foydalanishingiz mumkin:"
        )
        if update.callback_query:
            await update.callback_query.edit_message_text(text, parse_mode='HTML', reply_markup=reply_markup)
        elif update.message:
            await update.message.reply_html(text, reply_markup=reply_markup)
    elif role == 'teacher':
        keyboard = [
            [InlineKeyboardButton("📚 Mening Guruhlarim", callback_data='my_groups')],
            [InlineKeyboardButton("📝 Uy vazifalari", callback_data='homework')],
            [InlineKeyboardButton("ℹ️ Yordam", callback_data='help')],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        text = (
            f"<b>👋 Assalomu alaykum, Ustoz!</b>\n\n"
            f"Quyidagi bo'limlardan foydalanishingiz mumkin:"
        )
        if update.callback_query:
            await update.callback_query.edit_message_text(text, parse_mode='HTML', reply_markup=reply_markup)
        elif update.message:
            await update.message.reply_html(text, reply_markup=reply_markup)
    else: # student
        text = "ℹ️ <b>Ma'lumot:</b> Hozircha siz bot orqali faqatgina davomat, uy vazifalari va to'lovlar haqida xabarnomalar qabul qilasiz. O'zingiz botga so'rov yubora olmaysiz."
        if update.callback_query:
            await update.callback_query.edit_message_text(text, parse_mode='HTML')
        elif update.message:
            await update.message.reply_html(text)
        return

@require_auth
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Yordam komandasi"""
    role = context.user_data.get('role')
    
    if role in ['admin', 'super_admin']:
        help_text = (
            f"<b>📚 Yordam</b>\n\n"
            f"<b>Mavjud buyruqlar:</b>\n"
            f"/start - Boshlash\n"
            f"/menu - Asosiy menyu\n"
            f"/admin - Admin panel\n"
            f"/help - Yordam\n\n"
            f"<b>Avtomatik hisobotlar:</b>\n"
            f"• Kunlik hisobot - Har kuni soat 20:00 da\n"
            f"• Oylik davomat - Oy oxirida soat 21:00 da\n"
            f"• Oylik moliya (Super Admin) - Oy oxirida soat 21:30 da"
        )
    else:
        help_text = (
            f"<b>📚 Yordam</b>\n\n"
            f"<b>Mavjud buyruqlar:</b>\n"
            f"/start - Boshlash\n"
            f"/menu - Asosiy menyu\n"
            f"/help - Yordam"
        )
    
    if update.message:
        await update.message.reply_html(help_text)
    elif update.callback_query:
        keyboard = [[InlineKeyboardButton("🔙 Orqaga", callback_data='admin_panel')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.callback_query.edit_message_text(help_text, parse_mode='HTML', reply_markup=reply_markup)

@require_admin
async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin panel"""
    await show_main_menu(update, context)

@require_auth
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Tugma callback'larini qayta ishlash"""
    query = update.callback_query
    await query.answer()
    
    callback_data = query.data
    role = context.user_data.get('role')
    profile = context.user_data.get('bot_profile')
    
    if role == 'student':
        await query.answer("Kechirasiz, menyudan foydalanish vaqtincha cheklangan.", show_alert=True)
        return
        
    if callback_data == 'admin_panel':
        await show_main_menu(update, context)
    
    elif callback_data == 'daily_report':
        if role in ['admin', 'super_admin']:
            from telegram_bot.reports_bot_logic import generate_and_send_report_pandas
            from django.conf import settings
            from asgiref.sync import sync_to_async
            
            await query.edit_message_text(f"<b>⏳ Hisobot tayyorlanmoqda...</b>\n\nHisobot tez orada yuboriladi.", parse_mode='HTML')
            
            if getattr(settings, 'DEBUG', False):
                await sync_to_async(generate_and_send_report_pandas)("daily_branch", profile.user_id, is_manual=True)
            else:
                generate_and_send_report_pandas.delay("daily_branch", profile.user_id, is_manual=True)
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
    
    elif callback_data == 'financial_report':
        if role == 'super_admin':
            from telegram_bot.reports_bot_logic import generate_and_send_report_pandas
            from django.conf import settings
            from asgiref.sync import sync_to_async
            
            await query.edit_message_text(f"<b>⏳ Oylik moliyaviy hisobot tayyorlanmoqda...</b>\n\nHisobot tez orada yuboriladi.", parse_mode='HTML')
            
            if getattr(settings, 'DEBUG', False):
                await sync_to_async(generate_and_send_report_pandas)("monthly_finance", profile.user_id, is_manual=True)
            else:
                generate_and_send_report_pandas.delay("monthly_finance", profile.user_id, is_manual=True)
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
            
    elif callback_data == 'group_report_list':
        if role in ['admin', 'super_admin']:
            from asgiref.sync import sync_to_async
            from groups.models import Group
            
            # Fetch active groups for the branch
            if role == 'super_admin':
                groups = await sync_to_async(list)(Group.objects.filter(is_faol=True).order_by('branch__name', 'name'))
            else:
                groups = await sync_to_async(list)(Group.objects.filter(branch_id=profile.user.branch_id, is_faol=True).order_by('name'))
                
            if not groups:
                await query.edit_message_text("<b>❌ Faol guruhlar topilmadi.</b>", parse_mode='HTML')
                return
                
            text = "<b>Guruh davomat hisoboti:</b>\n\nQaysi guruh hisobotini yuklab olmoqchisiz?\n\n"
            keyboard = []
            row = []
            for i, group in enumerate(groups, start=1):
                text += f"{i}. {group.name} (ID: {group.id})\n"
                row.append(InlineKeyboardButton(str(i), callback_data=f'group_report_download_{group.id}'))
                if len(row) == 5:
                    keyboard.append(row)
                    row = []
            if row:
                keyboard.append(row)
                
            keyboard.append([InlineKeyboardButton("🔙 Orqaga", callback_data='admin_panel')])
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(text, parse_mode='HTML', reply_markup=reply_markup)
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
            
    elif callback_data.startswith('group_report_download_'):
        if role in ['admin', 'super_admin']:
            group_id = callback_data.split('_')[-1]
            from telegram_bot.reports_bot_logic import generate_and_send_report_pandas
            from django.conf import settings
            from asgiref.sync import sync_to_async
            
            await query.edit_message_text(f"<b>⏳ Guruh davomat hisoboti tayyorlanmoqda...</b>\n\nTez orada yuboriladi.", parse_mode='HTML')
            
            if getattr(settings, 'DEBUG', False):
                await sync_to_async(generate_and_send_report_pandas)("group_attendance", profile.user_id, is_manual=True, group_id=group_id)
            else:
                generate_and_send_report_pandas.delay("group_attendance", profile.user_id, is_manual=True, group_id=group_id)
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
    
    elif callback_data == 'help':
        await help_command(update, context)
    
    else:
        keyboard = [[InlineKeyboardButton("🔙 Orqaga", callback_data='admin_panel')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            f"<b>ℹ️ Ma'lumot</b>\n\nBu funksiya hozircha ishlab chiqilmoqda.\nTez orada qo'shiladi.", 
            parse_mode='HTML',
            reply_markup=reply_markup
        )

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Oddiy matnlarga javob"""
    role = context.user_data.get('role', 'guest')
    text = update.message.text
    
    if text == "Menyuga qaytish":
        if role != 'guest':
            await show_main_menu(update, context)
        else:
            await update.message.reply_html("Iltimos, avval ro'yxatdan o'ting (/start).")
        return
    
    if role == 'student':
        await update.message.reply_html(
            "ℹ️ <b>Ma'lumot:</b> Hozircha siz bot orqali faqatgina davomat, uy vazifalari va to'lovlar haqida xabarnomalar qabul qilasiz. O'zingiz botga so'rov yubora olmaysiz."
        )
    elif role != 'guest':
        await update.message.reply_html(
            f"<b>ℹ️ Menyu</b>\n\nAsosiy menyu uchun /menu buyrug'ini bering yoki pastdagi tugmani bosing."
        )
    else:
        await update.message.reply_html(
            "Iltimos, pastdagi tugmani bosing yoki raqamingizni yuboring."
        )

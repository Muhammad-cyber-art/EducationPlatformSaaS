import os
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


def build_bot_application(token, schema_name=None, tenant_name=None):
    """Har bir tenant uchun mustaqil Application va Persistence ob'ektini qurish"""
    prefix = f"_{schema_name}" if schema_name else ""

    # Pickle fayllar alohida papkada saqlanadi (Docker volume ga mount qilinadi)
    persistence_dir = os.path.join(str(settings.BASE_DIR), "bot_persistence")
    os.makedirs(persistence_dir, exist_ok=True)
    persistence_path = os.path.join(persistence_dir, f"bot{prefix}.pickle")
    
    # Agar pickle fayli mavjud bo'lsa, lekin bo'sh (0 bayt) yoki buzilgan bo'lsa, uni tozalaymiz
    if os.path.exists(persistence_path):
        try:
            if os.path.getsize(persistence_path) == 0:
                logger.warning(f"bot_persistence{prefix}.pickle bo'sh (0 bayt), o'chirilmoqda.")
                os.remove(persistence_path)
            else:
                import pickle
                with open(persistence_path, 'rb') as f:
                    data = pickle.load(f)
                    # Eski pickle fayllarda tenant_schema xato qiymat bo'lishi mumkin —
                    # uni tozalab yangi schemaga o'rnatamiz
                    if isinstance(data, dict) and isinstance(data.get('bot_data'), dict):
                        old_schema = data['bot_data'].get('tenant_schema')
                        if old_schema != schema_name:
                            logger.warning(
                                f"Pickle faylda eski schema '{old_schema}' topildi, "
                                f"'{schema_name}' bilan almashtirilmoqda. Pickle o'chirilmoqda."
                            )
                            os.remove(persistence_path)
        except Exception as e:
            logger.warning(f"bot_persistence{prefix}.pickle shikastlangan ({e}), yangidan boshlanmoqda.")
            try:
                os.remove(persistence_path)
            except Exception:
                pass

    persistence = PicklePersistence(filepath=persistence_path)

    # post_init: persistence yuklanganidan KEYIN bot_data ni o'rnatamiz
    # Bu pickle fayldan eski bot_data yuklansa ham bizning schema qiymatimiz to'g'ri bo'lishini kafolatlaydi
    async def _post_init(application):
        application.bot_data['tenant_schema'] = schema_name
        application.bot_data['tenant_name'] = tenant_name
        logger.info(
            f"[BOT_INIT] Bot tayyor | schema={schema_name!r} | tenant={tenant_name!r} | "
            f"bot_data tenant_schema={application.bot_data.get('tenant_schema')!r}"
        )

    app = ApplicationBuilder().token(token).persistence(persistence).post_init(_post_init).build()

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
        name=f"auth_conversation{prefix}",
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
    app.add_error_handler(error_handler)

    return app


class Command(BaseCommand):
    help = "Telegram botni ishga tushirish (Multi-tenant va har bir o'quv markaz uchun alohida bot)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--schema',
            type=str,
            default=None,
            help="Aniq bir tenant schemasi uchun botni ishga tushirish (masalan: tenant_najot)"
        )
        parser.add_argument(
            '--tenant',
            type=str,
            default=None,
            help="Tenant nomi yoki subdomaini bo'yicha botni ishga tushirish"
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Bot boshqaruv tizimi ishga tushmoqda..."))
        target_schema = options.get('schema')
        target_tenant = options.get('tenant')

        try:
            from tenants.models import Tenant

            # 1. Aniq bitta tenant ko'rsatilgan bo'lsa
            if target_schema or target_tenant:
                query = Q(schema_name=target_schema) if target_schema else (Q(subdomain=target_tenant) | Q(name__iexact=target_tenant))
                tenant = Tenant.objects.filter(query).first()
                if not tenant:
                    self.stdout.write(self.style.ERROR(f"XATO: Ko'rsatilgan o'quv markaz topilmadi (schema: {target_schema}, tenant: {target_tenant})!"))
                    return
                
                token = tenant.telegram_bot_token
                if not token:
                    self.stdout.write(self.style.ERROR(f"XATO: '{tenant.name}' ({tenant.schema_name}) o'quv markazi uchun telegram_bot_token kiritilmagan!\nCEO paneldan o'quv markazni tahrirlab bot tokenni kiriting."))
                    return

                self.stdout.write(self.style.SUCCESS(f">>> '{tenant.name}' ({tenant.schema_name}) uchun bot polling rejimida ishga tushirilmoqda..."))
                app = build_bot_application(token, schema_name=tenant.schema_name, tenant_name=tenant.name)
                app.run_polling(drop_pending_updates=True)
                return

            # 2. Argument berilmagan bo'lsa: Bazadagi barcha bot tokeni bor faol tenantlarni qidiramiz
            active_tenants = list(Tenant.objects.filter(is_active=True).exclude(Q(telegram_bot_token__isnull=True) | Q(telegram_bot_token='')))
        except Exception as db_err:
            logger.warning(f"Tenantlarni bazadan o'qishda xatolik ({db_err}). Fallback tekshirilmoqda...")
            active_tenants = []
        
        if not active_tenants:
            # Fallback: settings.TELEGRAM_BOT_TOKEN
            fallback_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
            if fallback_token:
                self.stdout.write(self.style.WARNING("Ogohlantirish: O'quv markazlarda alohida bot token topilmadi. Fallback (.env / settings.TELEGRAM_BOT_TOKEN) ishlatilmoqda..."))
                app = build_bot_application(fallback_token, schema_name=None, tenant_name='Global')
                app.run_polling(drop_pending_updates=True)
                return
            else:
                self.stdout.write(self.style.ERROR("XATO: Hech bir o'quv markazda telegram bot token topilmadi va settings.TELEGRAM_BOT_TOKEN ham bo'sh!\nCEO paneldan o'quv markazga bot token kiriting yoki --schema parametrini bering."))
                return

        if len(active_tenants) == 1:
            t = active_tenants[0]
            self.stdout.write(self.style.SUCCESS(f">>> 1 ta faol bot topildi: '{t.name}' ({t.schema_name}). Ishga tushirilmoqda..."))
            app = build_bot_application(t.telegram_bot_token, schema_name=t.schema_name, tenant_name=t.name)
            app.run_polling(drop_pending_updates=True)
            return

        # 3. Bir nechta o'quv markaz botlari bo'lsa: ularni parallel polling qilamiz
        self.stdout.write(self.style.SUCCESS(f">>> {len(active_tenants)} ta o'quv markaz botlari parallel ishga tushirilmoqda:"))
        apps = []
        for t in active_tenants:
            self.stdout.write(f"  • {t.name} (schema: {t.schema_name})")
            apps.append(build_bot_application(t.telegram_bot_token, schema_name=t.schema_name, tenant_name=t.name))
        
        import asyncio
        async def run_all():
            for app in apps:
                await app.initialize()
                await app.start()
                await app.updater.start_polling(drop_pending_updates=True)
            self.stdout.write(self.style.SUCCESS(">>> Barcha botlar muvaffaqiyatli ishga tushdi va xabarlarni tinglamoqda..."))
            stop_event = asyncio.Event()
            try:
                await stop_event.wait()
            except (asyncio.CancelledError, KeyboardInterrupt):
                pass
            finally:
                for app in apps:
                    try:
                        if app.updater and app.updater.running:
                            await app.updater.stop()
                        if app.running:
                            await app.stop()
                        await app.shutdown()
                    except Exception as err:
                        logger.error(f"Bot to'xtatishda xatolik: {err}")

        try:
            asyncio.run(run_all())
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS("Botlar to'xtatildi."))

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

def _internal_process_contact(clean_phone, chat_id):
    """
    Telefon raqami bo'yicha UserModel va Student qidirish va BotProfile yaratish.
    Bazada raqam har qanday formatda ('93-69709-26', '+998 93 697 09 26', '936970926' va h.k.)
    saqlangan bo'lsa ham, normalize qilinib moslik aniqlanadi.
    """
    from django.db import connection

    try:
        # Joriy schema ni log ga yozish (debugging uchun)
        with connection.cursor() as cur:
            cur.execute("SHOW search_path")
            current_sp = cur.fetchone()
        logger.info(f"[PROCESS_CONTACT] start | chat_id={chat_id} | phone={clean_phone!r} | search_path={current_sp}")
    except Exception as sp_err:
        logger.warning(f"[PROCESS_CONTACT] search_path o'qishda xatolik: {sp_err}")

    def normalize_digits(p):
        return re.sub(r'\D', '', str(p or ''))

    norm_incoming = normalize_digits(clean_phone)
    local_9 = norm_incoming[-9:] if len(norm_incoming) >= 9 else norm_incoming
    with_998 = '998' + local_9 if len(local_9) == 9 else norm_incoming
    possible_numbers = {norm_incoming, local_9, with_998}
    logger.info(f"[PROCESS_CONTACT] possible_numbers={possible_numbers}")

    def is_phone_match(raw_db_phone):
        if not raw_db_phone:
            return False
        norm_db = normalize_digits(raw_db_phone)
        if not norm_db:
            return False
        if norm_db in possible_numbers:
            return True
        if len(norm_db) >= 9 and len(local_9) >= 9:
            return norm_db[-9:] == local_9
        return norm_db.endswith(local_9) or local_9.endswith(norm_db)

    try:
        # 1. Admin/Super Admin/Mentor/Teacher qidirish
        all_users = UserModel.objects.select_related('branch').filter(
            role__in=['admin', 'super_admin', 'mentor', 'teacher'],
            is_active=True,
            phone_number__isnull=False
        )
        user_count = all_users.count()
        logger.info(f"[PROCESS_CONTACT] Foydalanuvchilar (admin/mentor) soni: {user_count}")
        for user in all_users:
            if is_phone_match(user.phone_number):
                logger.info(f"[PROCESS_CONTACT] Admin topildi: {user.username} [{user.role}]")
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
                # UserModel bilan ham telegram_chat_id ni sinxronlashtirish
                if user.telegram_chat_id != chat_id:
                    user.telegram_chat_id = chat_id
                    user.save(update_fields=['telegram_chat_id'])
                return profile, 'admin_confirm_needed'

        # 2. Student qidirish
        all_students = Student.objects.filter(is_active=True)
        student_count = all_students.count()
        logger.info(f"[PROCESS_CONTACT] Faol o'quvchilar soni: {student_count}")

        found_student_names = []
        student_profile_created = False
        profile = None

        for student in all_students:
            phone_match = is_phone_match(student.phone)
            parent_match = is_phone_match(student.parent_phone)
            logger.debug(f"[PROCESS_CONTACT]   student={student.full_name!r} phone={student.phone!r}(match={phone_match}) parent_phone={student.parent_phone!r}(match={parent_match})")

            if not phone_match and not parent_match:
                continue

            logger.info(f"[PROCESS_CONTACT] O'quvchi TOPILDI: {student.full_name} | phone_match={phone_match} | parent_match={parent_match}")

            # Student modeliga telegram_id yozib qo'yish
            update_fields = []
            if phone_match and student.telegram_id != chat_id:
                student.telegram_id = chat_id
                update_fields.append('telegram_id')
            if parent_match and student.parent_telegram_id != chat_id:
                student.parent_telegram_id = chat_id
                update_fields.append('parent_telegram_id')
            if update_fields:
                student.save(update_fields=update_fields)
                logger.info(f"[PROCESS_CONTACT] Student.{update_fields} yangilandi.")

            if not student_profile_created:
                BotProfile.objects.filter(telegram_id=chat_id).exclude(student=student).delete()
                profile, created = BotProfile.objects.update_or_create(
                    student=student,
                    defaults={
                        'telegram_id': chat_id,
                        'phone_number': student.phone or student.parent_phone or clean_phone,
                        'role': 'student',
                        'is_active': True
                    }
                )
                logger.info(f"[PROCESS_CONTACT] BotProfile {'yaratildi' if created else 'yangilandi'}: id={profile.id}")
                student_profile_created = True

            # Guruhlarni to'g'ri usulda olish (M2M reverse lookup xatosini oldini olish)
            try:
                from groups.models import GroupEnrollment
                active_enrollment_groups = list(
                    GroupEnrollment.objects.filter(
                        student=student, is_active=True
                    ).select_related('group').values_list('group__name', flat=True)
                )
            except Exception as ge:
                logger.warning(f"[PROCESS_CONTACT] GroupEnrollment xatosi: {ge}")
                active_enrollment_groups = []

            if not active_enrollment_groups and student.group_id:
                try:
                    active_enrollment_groups = [student.group.name]
                except Exception:
                    active_enrollment_groups = []

            if not active_enrollment_groups:
                found_student_names.append(f"{student.full_name.strip()} (Guruhsiz)")
            else:
                for group_name in active_enrollment_groups:
                    found_student_names.append(f"{student.full_name.strip()} ({group_name})")

        if student_profile_created:
            logger.info(f"[PROCESS_CONTACT] Natija: student topildi, guruhlar={found_student_names}")
            return profile, found_student_names

        logger.info(f"[PROCESS_CONTACT] Natija: hech kim topilmadi (phone={clean_phone!r})")
        return None, None

    except Exception as exc:
        logger.error(f"[PROCESS_CONTACT] XATOLIK: {exc}", exc_info=True)
        return None, None

@sync_to_async
def process_contact_and_create_profile(clean_phone, chat_id, schema_name=None):
    """
    Telefon raqami bo'yicha UserModel va Student qidirish va BotProfile yaratish.
    Agar schema_name berilgan bo'lsa, mos tenant schemasida bajariladi.
    """
    if schema_name:
        from tenants.utils import tenant_schema_context
        with tenant_schema_context(schema_name):
            return _internal_process_contact(clean_phone, chat_id)
    return _internal_process_contact(clean_phone, chat_id)

async def contact_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Kontakt kelganda uni bazada qidirish (student va admin)"""
    contact = update.message.contact
    phone = contact.phone_number
    clean_phone = re.sub(r'\D', '', phone)
    chat_id = str(update.effective_chat.id)
    schema_name = context.bot_data.get('tenant_schema')
    
    profile, result = await process_contact_and_create_profile(clean_phone, chat_id, schema_name=schema_name)
    
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
        keyboard = [[KeyboardButton("📞 Telefon raqamni yuborish", request_contact=True)]]
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)
        await update.message.reply_html(
            f"❌ <b>Kechirasiz!</b>\n\n"
            f"Tizimda <code>{phone}</code> raqami topilmadi.\n"
            f"Iltimos, markazga murojaat qilib, raqamingizni to'g'irlatib oling.\n\n"
            f"Yoki <b>boshqa raqam</b> bilan qaytadan urinib ko'ring:",
            reply_markup=reply_markup
        )
        return PHONE

async def confirm_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin tasdiqlash jarayoni"""
    text = update.message.text.strip().upper()
    
    if text == 'HA':
        profile = context.user_data.get('bot_profile')
        schema_name = context.bot_data.get('tenant_schema')
        if profile:
            if profile.user and profile.user.telegram_chat_id != str(update.effective_chat.id):
                profile.user.telegram_chat_id = str(update.effective_chat.id)
                def _save_user_chat_id():
                    if schema_name:
                        from tenants.utils import tenant_schema_context
                        with tenant_schema_context(schema_name):
                            profile.user.save(update_fields=['telegram_chat_id'])
                    else:
                        profile.user.save(update_fields=['telegram_chat_id'])
                await sync_to_async(_save_user_chat_id)()

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
    elif role in ['teacher', 'mentor']:
        keyboard = [
            [InlineKeyboardButton("📚 Mening Guruhlarim", callback_data='my_groups')],
            [InlineKeyboardButton("ℹ️ Yordam", callback_data='help')],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        text = (
            f"<b>👋 Assalomu alaykum, {profile.get_full_name()}!</b>\n\n"
            f"Rol: <b>O'qituvchi / Mentor</b>\n\n"
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
    schema_name = context.bot_data.get('tenant_schema')
    
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
            
            def _trigger_daily():
                token = getattr(getattr(context, 'bot', None), 'token', None)
                if getattr(settings, 'DEBUG', False):
                    if schema_name:
                        from tenants.utils import tenant_schema_context
                        with tenant_schema_context(schema_name):
                            generate_and_send_report_pandas("daily_branch", profile.user_id, is_manual=True, schema_name=schema_name, bot_token=token)
                    else:
                        generate_and_send_report_pandas("daily_branch", profile.user_id, is_manual=True, schema_name=schema_name, bot_token=token)
                else:
                    generate_and_send_report_pandas.delay("daily_branch", profile.user_id, is_manual=True, schema_name=schema_name, bot_token=token)
            await sync_to_async(_trigger_daily)()
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
    
    elif callback_data == 'financial_report':
        if role == 'super_admin':
            from telegram_bot.reports_bot_logic import generate_and_send_report_pandas
            from django.conf import settings
            from asgiref.sync import sync_to_async
            
            await query.edit_message_text(f"<b>⏳ Oylik moliyaviy hisobot tayyorlanmoqda...</b>\n\nHisobot tez orada yuboriladi.", parse_mode='HTML')
            
            def _trigger_fin():
                token = getattr(getattr(context, 'bot', None), 'token', None)
                if getattr(settings, 'DEBUG', False):
                    if schema_name:
                        from tenants.utils import tenant_schema_context
                        with tenant_schema_context(schema_name):
                            generate_and_send_report_pandas("monthly_finance", profile.user_id, is_manual=True, schema_name=schema_name, bot_token=token)
                    else:
                        generate_and_send_report_pandas("monthly_finance", profile.user_id, is_manual=True, schema_name=schema_name, bot_token=token)
                else:
                    generate_and_send_report_pandas.delay("monthly_finance", profile.user_id, is_manual=True, schema_name=schema_name, bot_token=token)
            await sync_to_async(_trigger_fin)()
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
            
    elif callback_data == 'group_report_list':
        if role in ['admin', 'super_admin']:
            from asgiref.sync import sync_to_async
            from groups.models import Group
            
            def _get_groups():
                if schema_name:
                    from tenants.utils import tenant_schema_context
                    with tenant_schema_context(schema_name):
                        if role == 'super_admin':
                            return list(Group.objects.filter(is_faol=True).order_by('branch__name', 'name'))
                        return list(Group.objects.filter(branch_id=profile.user.branch_id, is_faol=True).order_by('name'))
                else:
                    if role == 'super_admin':
                        return list(Group.objects.filter(is_faol=True).order_by('branch__name', 'name'))
                    return list(Group.objects.filter(branch_id=profile.user.branch_id, is_faol=True).order_by('name'))
            
            groups = await sync_to_async(_get_groups)()
                
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
            
            def _trigger_grp_download():
                token = getattr(getattr(context, 'bot', None), 'token', None)
                if getattr(settings, 'DEBUG', False):
                    if schema_name:
                        from tenants.utils import tenant_schema_context
                        with tenant_schema_context(schema_name):
                            generate_and_send_report_pandas("group_attendance", profile.user_id, is_manual=True, group_id=group_id, schema_name=schema_name, bot_token=token)
                    else:
                        generate_and_send_report_pandas("group_attendance", profile.user_id, is_manual=True, group_id=group_id, schema_name=schema_name, bot_token=token)
                else:
                    generate_and_send_report_pandas.delay("group_attendance", profile.user_id, is_manual=True, group_id=group_id, schema_name=schema_name, bot_token=token)
            await sync_to_async(_trigger_grp_download)()
    elif callback_data == 'my_groups':
        if role in ['teacher', 'mentor']:
            from asgiref.sync import sync_to_async
            from groups.models import Group
            
            mentor_user = profile.user
            if not mentor_user:
                await query.edit_message_text("<b>❌ O'qituvchi ma'lumotlari topilmadi.</b>", parse_mode='HTML')
                return
            
            def _get_mentor_groups():
                if schema_name:
                    from tenants.utils import tenant_schema_context
                    with tenant_schema_context(schema_name):
                        return list(
                            Group.objects.filter(
                                Q(mentor=mentor_user) | Q(additional_mentors__mentor=mentor_user),
                                is_faol=True
                            ).distinct().order_by('name')
                        )
                else:
                    return list(
                        Group.objects.filter(
                            Q(mentor=mentor_user) | Q(additional_mentors__mentor=mentor_user),
                            is_faol=True
                        ).distinct().order_by('name')
                    )
            
            groups = await sync_to_async(_get_mentor_groups)()
            
            if not groups:
                text = "📚 <b>Sizga biriktirilgan faol guruhlar topilmadi.</b>"
            else:
                text = "<b>📚 Sizning faol guruhlaringiz:</b>\n\n"
                for i, g in enumerate(groups, start=1):
                    days_str = g.get_days_display() if hasattr(g, 'get_days_display') else ''
                    time_str = g.start_time.strftime('%H:%M') if getattr(g, 'start_time', None) else ''
                    text += f"{i}. <b>{g.name}</b>\n   📅 Kunlar: {days_str}\n   ⏰ Vaqt: {time_str}\n\n"
                    
            keyboard = [[InlineKeyboardButton("🔙 Orqaga", callback_data='admin_panel')]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text(text, parse_mode='HTML', reply_markup=reply_markup)
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

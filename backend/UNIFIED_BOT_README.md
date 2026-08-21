# Unified Telegram Bot - RBAC and Reporting System

## Overview

This is a **single, universal Telegram bot** that serves all user roles (students, admins, super_admins) with Role-Based Access Control (RBAC) and automated reporting. The bot dynamically adapts its interface based on the user's role determined through phone number authentication.

## Architecture

### Key Design Principles

- **Single Bot Instance**: One bot serves all roles (no separate admin bot)
- **Context-Aware Authentication**: Phone number determines user role
- **Dynamic Interface**: Menus adapt based on user role
- **Decoupled Services**: Reporting service is separate from bot controller
- **Asynchronous Processing**: Celery + Redis for background tasks

## Features

### Authentication & Authorization

1. **Phone-Based Authentication**
   - Users share their phone number via Telegram contact
   - System checks database to determine role
   - Admins require confirmation (HA/YOQ)
   - Students are auto-confirmed

2. **Role-Based Access Control**
   - **Student**: Access to personal attendance, payments, homework
   - **Admin**: Access to branch-specific reports and admin panel
   - **Super_Admin**: Access to comprehensive financial reports and all branches

3. **Middleware System**
   - `@require_authentication` decorator for authenticated users
   - `@require_admin` decorator for admin/super_admin only
   - `@require_super_admin` decorator for super_admin only
   - `@require_role('role1', 'role2')` for custom role combinations

### Dynamic Menus

#### Student Menu
- 📚 Mening Guruhim (My Group)
- 📊 Davomat (Attendance)
- 💰 To'lovlar (Payments)
- 📝 Uy vazifalari (Homework)
- ℹ️ Yordam (Help)

#### Admin Menu
- 📊 Admin Panel
- 📋 Kunlik Hisobot (Daily Report)
- 📁 Oylik Davomat (Monthly Attendance)
- ℹ️ Yordam (Help)

#### Super Admin Menu
- All admin features plus:
- 💰 Moliyaviy Hisobot (Financial Report)

### Automated Reporting

1. **Daily Branch Reports**
   - Excel files with attendance and homework
   - Sent to admins daily at 8:00 PM
   - Branch-specific data only

2. **Monthly Attendance Archives**
   - ZIP archives of daily attendance reports
   - Sent to admins on last day of month at 9:00 PM
   - Contains all daily reports for the month

3. **Monthly Financial Reports**
   - Comprehensive Excel with multiple sheets
   - Sent to super_admins on last day of month at 9:30 PM
   - Includes: student payments, salaries, transactions, statistics

## Installation & Setup

### 1. Database Migration

Add the `telegram_chat_id` field to the User model:

```bash
python manage.py makemigrations authenticatsiya
python manage.py migrate
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Main Bot Token (serves all roles)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### 3. Dependencies

Ensure all required packages are installed (already in `requirements.txt`):

```
celery
redis
django-celery-beat
openpyxl
python-telegram-bot
```

### 4. Start Services

```bash
# Start the bot
python manage.py runbot

# Start Celery Worker
celery -A config worker -l info

# Start Celery Beat
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## Usage

### For Students

1. **Authentication**:
   - Open the bot in Telegram
   - Send `/start` command
   - Share your phone number
   - Bot automatically confirms if found in database

2. **Available Commands**:
   - `/start` - Begin authentication
   - `/menu` - Show main menu
   - `/help` - Show help message

### For Admins

1. **Authentication**:
   - Open the bot in Telegram
   - Send `/start` command
   - Share your phone number
   - Confirm with "HA" when prompted

2. **Available Commands**:
   - `/start` - Begin authentication
   - `/menu` - Show main menu
   - `/admin` - Open admin panel
   - `/help` - Show help message

3. **Admin Panel Features**:
   - Request daily reports manually
   - Request monthly attendance archives
   - View automated report schedule

### For Super Admins

1. **Authentication**: Same as admins
2. **Additional Features**:
   - Access to financial reports
   - System-wide statistics
   - All admin features

## File Structure

```
backend/
├── telegram_bot/
│   ├── management/commands/
│   │   └── runbot.py              # Main bot command (all roles)
│   ├── bot_middleware.py          # RBAC middleware and decorators
│   ├── signals.py                 # Signal handlers
│   ├── tasks.py                   # Celery tasks
│   ├── utils.py                   # Utility functions
│   └── views.py                   # API views
├── reports/
│   ├── report_generator.py        # Report generation service
│   ├── admin_tasks.py             # Celery tasks for reports
│   └── services.py               # Existing report services
├── authenticatsiya/
│   └── models.py                  # User model with telegram_chat_id
└── config/
    └── celery.py                  # Celery configuration with beat schedule
```

## API Endpoints

### Manual Report Triggering

```python
from reports.admin_tasks import (
    send_manual_daily_report,
    send_manual_monthly_attendance,
    send_manual_monthly_financial
)

# Daily report for specific admin
send_manual_daily_report.delay(admin_id=1, target_date_str='2024-01-15')

# Monthly attendance for specific admin
send_manual_monthly_attendance.delay(admin_id=1, year=2024, month=1)

# Monthly financial for super admin
send_manual_monthly_financial.delay(super_admin_id=1, year=2024, month=1)
```

## Middleware Usage

### In Bot Handlers

```python
from telegram_bot.bot_middleware import require_authentication, require_admin

@require_authentication
async def protected_command(update, context):
    user_context = context.user_data.get('user_context')
    # Access user info
    await update.message.reply_text(f"Hello {user_context.full_name}")

@require_admin
async def admin_only_command(update, context):
    # Only admins and super_admins can access
    await update.message.reply_text("Admin panel")
```

### Custom Role Check

```python
from telegram_bot.bot_middleware import require_role

@require_role('super_admin')
async def super_admin_only(update, context):
    # Only super_admin can access
    await update.message.reply_text("Super admin panel")
```

## Configuration

### Celery Beat Schedule

Edit `config/celery.py` to customize schedules:

```python
app.conf.beat_schedule = {
    'send-daily-reports-to-admins': {
        'task': 'reports.send_daily_reports_to_admins',
        'schedule': crontab(hour=20, minute=0),  # 8:00 PM
    },
    'send-monthly-attendance-to-admins': {
        'task': 'reports.send_monthly_attendance_to_admins',
        'schedule': crontab(hour=21, minute=0, day_of_month='28-31'),
    },
    'send-monthly-financial-to-super-admins': {
        'task': 'reports.send_monthly_financial_to_super_admins',
        'schedule': crontab(hour=21, minute=30, day_of_month='28-31'),
    },
}
```

### Timezone Configuration

```python
app.conf.timezone = 'Asia/Tashkent'  # or your preferred timezone
```

## Security Considerations

1. **Phone Verification**: Only authorized numbers can access admin functions
2. **Role-Based Access**: Strict separation between roles
3. **Branch Isolation**: Admins only see data for their assigned branch
4. **Confirmation Flow**: Admins must confirm their identity
5. **Middleware Protection**: All admin commands protected by decorators

## Troubleshooting

### Common Issues

1. **Bot not starting**:
   - Check `TELEGRAM_BOT_TOKEN` in `.env`
   - Verify token is valid

2. **Authentication failing**:
   - Verify phone number matches database exactly
   - Check user role is correct
   - Ensure user is active (`is_active=True`)

3. **Reports not sending**:
   - Check Celery worker is running
   - Verify user has `telegram_chat_id` set
   - Check user has branch assigned (for admins)

4. **Middleware errors**:
   - Ensure `bot_middleware.py` is imported correctly
   - Check decorator usage is correct

## Development

### Adding New Features

1. **Add new command**:
   - Create handler function
   - Add appropriate decorator
   - Register in `runbot.py`

2. **Add new report type**:
   - Add method to `ReportGenerator`
   - Add distribution method to `ReportDistributor`
   - Create Celery task in `admin_tasks.py`
   - Update beat schedule

3. **Add new role**:
   - Update `UserModel.ROLE_CHOICES`
   - Update middleware decorators
   - Add role-specific menu logic

## Testing

### Test Authentication

```bash
python manage.py shell
>>> from telegram_bot.bot_middleware import get_user_context
>>> context = await get_user_context('123456789')
>>> print(context.role)
```

### Test Reports

```bash
python manage.py shell
>>> from reports.admin_tasks import send_manual_daily_report
>>> send_manual_daily_report.delay(admin_id=1)
```

## Production Deployment

### Checklist

- [ ] Set up Redis for Celery broker
- [ ] Configure Celery beat with database scheduler
- [ ] Set up process managers (supervisor/systemd)
- [ ] Configure log rotation
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Test failover scenarios
- [ ] Document backup procedures

### Systemd Service Example

**Bot Service**:
```ini
[Unit]
Description=Telegram Bot
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/project
ExecStart=/path/to/venv/bin/python manage.py runbot
Restart=always

[Install]
WantedBy=multi-user.target
```

**Celery Worker**:
```ini
[Unit]
Description=Celery Worker
After=network.target

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/path/to/project
ExecStart=/path/to/venv/bin/celery -A config worker -l info
Restart=always

[Install]
WantedBy=multi-user.target
```

**Celery Beat**:
```ini
[Unit]
Description=Celery Beat
After=network.target

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/path/to/project
ExecStart=/path/to/venv/bin/celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
Restart=always

[Install]
WantedBy=multi-user.target
```

## Support

For issues or questions:
1. Check logs for error messages
2. Review this documentation
3. Contact development team

## License

Proprietary - All rights reserved

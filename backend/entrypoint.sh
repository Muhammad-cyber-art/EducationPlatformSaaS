#!/bin/sh
set -e

# Database tayyor bo'lishini kutish
if [ "$DB_ENGINE" = "postgresql" ]; then
    echo ">>> PostgreSQL ni kutmoqdamiz ($DB_HOST:$DB_PORT)..."
    while ! nc -z "$DB_HOST" "$DB_PORT"; do
        sleep 0.5
    done
    echo ">>> PostgreSQL tayyor!"
fi

# Migratsiya va collectstatic faqat 'web' containerida (gunicorn) bajariladi
if [ "$1" = "gunicorn" ]; then
    echo ">>> Migratsiyalar bajarilmoqda (public schema)..."
    python manage.py migrate --noinput

    echo ">>> Barcha tenant schemalari migrate qilinmoqda..."
    python manage.py migrate_all_tenants --skip-public || true

    echo ">>> Static fayllar yig'ilmoqda..."
    mkdir -p /app/static /app/media
    python manage.py collectstatic --no-input --clear
    chmod -R 775 /app/static /app/media
fi

# Telegram bot uchun: pickle fayllar /app/bot_persistence/ papkasida saqlanadi
# Bu Docker volume ga mount qilinadi — restart bo'lganda conversation statelari saqlanadi
if [ "$1" = "python" ] && [ "$2" = "manage.py" ] && [ "$3" = "runbot" ]; then
    mkdir -p /app/bot_persistence
    # Eski pickle fayllarni asosiy papkadan ko'chirish (birinchi migrasiya)
    for f in /app/bot_persistence*.pickle; do
        [ -f "$f" ] && mv "$f" /app/bot_persistence/ 2>/dev/null || true
    done
fi

# Docker-compose dagi 'command' ni bajarish
echo ">>> Buyruq bajarilmoqda: $*"
exec "$@"

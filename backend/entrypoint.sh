#!/bin/sh
set -e

# Database tayyor bo'lishini kutish
if [ "$DB_ENGINE" = "postgresql" ]; then
    echo "PostgreSQL ni kutmoqdamiz ($DB_HOST:$DB_PORT)..."

    while ! nc -z $DB_HOST $DB_PORT; do
      sleep 0.1
    done

    echo "PostgreSQL ishga tushdi"
fi

# Migratsiyalarni va static fayllarni faqat bir marta (web containerida) bajarish
if [ "$1" = "gunicorn" ]; then
    echo "Migratsiyalar bajarilmoqda..."
    python manage.py migrate --noinput

    echo "Static fayllar yig'ilmoqda..."
    mkdir -p /app/static /app/media
    python manage.py collectstatic --no-input
    chmod -R 775 /app/static /app/media
fi

# Docker-compose dagi "command" qismini bajarish
echo "Asosiy buyruq bajarilmoqda: $@"
exec "$@"

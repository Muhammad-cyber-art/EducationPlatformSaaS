#!/bin/bash
# ==============================================================================
# YaxshiNiyat SaaS — PostgreSQL Avtomatik Backup Skripti
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# .env faylidan o'zgaruvchilarni yuklash
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.dump"
DAYS_TO_KEEP=14

# Konteyner nomi yoki serviceni aniqlash (db)
CONTAINER_NAME=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "XATO: PostgreSQL 'db' konteyneri topilmadi!"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo ">>> [$(date)] Baza rezerv nusxasi olinmoqda..."
echo ">>> Konteyner: $CONTAINER_NAME -> Fayl: $BACKUP_FILE"

# PostgreSQL custom binary dump olish (-F c siqilgan va tezkor format)
docker exec -i "$CONTAINER_NAME" pg_dump -U "${POSTGRES_USER:-education_user}" -d "${POSTGRES_DB:-education_db}" -F c > "$BACKUP_FILE"

# Fayl hajmi va butunligini tekshirish
if [ ! -s "$BACKUP_FILE" ]; then
    echo "XATO: Backup fayli bo'sh (0 bayt)! Bekor qilinmoqda."
    rm -f "$BACKUP_FILE"
    exit 1
fi

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ">>> Muvaffaqiyatli saqlandi! Hajmi: $FILE_SIZE"

# 14 kundan eski nusxalarni xavfsiz tozalash (disk to'lib qolmasligi uchun)
echo ">>> ${DAYS_TO_KEEP} kundan eski nusxalar tozalanmoqda..."
find "$BACKUP_DIR" -type f -name "backup_*.dump" -mtime +${DAYS_TO_KEEP} -delete

echo ">>> Barcha amallar muvaffaqiyatli yakunlandi! Fayl: $BACKUP_FILE"

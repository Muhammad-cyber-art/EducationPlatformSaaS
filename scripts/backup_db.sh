#!/bin/bash
# ==============================================================================
# YaxshiNiyat SaaS — PostgreSQL Avtomatik Backup Skripti
# ==============================================================================
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.dump"
DAYS_TO_KEEP=14

# Konteyner nomi yoki serviceni aniqlash
CONTAINER_NAME=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "XATO: PostgreSQL 'db' konteyneri topilmadi!"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo ">>> [$(date)] Baza rezerv nusxasi olinmoqda..."
echo ">>> Konteyner: $CONTAINER_NAME -> Fayl: $BACKUP_FILE"

# PostgreSQL custom binary dump olish
docker exec -i "$CONTAINER_NAME" pg_dump -U "${POSTGRES_USER:-education_user}" -d "${POSTGRES_DB:-education_db}" -F c > "$BACKUP_FILE"

# Hajmini tekshirish
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ">>> Muvaffaqiyatli saqlandi! Hajmi: $FILE_SIZE"

# 14 kundan eski nusxalarni tozalash
echo ">>> ${DAYS_TO_KEEP} kundan eski nusxalar tozalanmoqda..."
find "$BACKUP_DIR" -type f -name "backup_*.dump" -mtime +${DAYS_TO_KEEP} -delete

echo ">>> Barcha amallar yakunlandi!"

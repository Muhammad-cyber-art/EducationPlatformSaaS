#!/bin/bash
# ==============================================================================
# YaxshiNiyat SaaS — SSL Bootstrap & Let's Encrypt Setup Script
# Domain: chronous.uz & *.chronous.uz
# ==============================================================================
set -e

DOMAIN="chronous.uz"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}-0001"
EMAIL="admin@${DOMAIN}"

echo ">>> [1/4] SSL sertifikatlar tekshirilmoqda..."

if [ ! -d "$CERT_DIR" ]; then
    echo ">>> Ogohlantirish: Real SSL sertifikatlar topilmadi."
    echo ">>> Nginx konteyneri 'cannot load certificate' xatosi bilan to'xtab qolmasligi uchun"
    echo ">>> vaqtinchalik (self-signed) dummy sertifikat yaratilmoqda..."
    
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=localhost"
    
    echo ">>> Vaqtinchalik dummy sertifikat yaratildi: $CERT_DIR"
fi

echo ">>> [2/4] Docker Compose xizmatlari ishga tushirilmoqda..."
docker compose up -d

echo ">>> [3/4] Wildcard SSL (*.${DOMAIN}) bo'yicha ko'rsatma:"
echo "------------------------------------------------------------------------"
echo "MUHIM: Let's Encrypt Wildcard (*.${DOMAIN}) sertifikatlarini HTTP-01"
echo "orqali bermaydi. Wildcard uchun DNS-01 challenge (masalan Cloudflare) kerak."
echo ""
echo "A) Cloudflare DNS orqali (TAVSIYA ETILADI - Wildcard subdomenlar uchun):"
echo "   apt-get install -y python3-certbot-dns-cloudflare"
echo "   certbot certonly --dns-cloudflare \\"
echo "     --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \\"
echo "     -d ${DOMAIN} -d *.${DOMAIN} -d admin.${DOMAIN} -d app.${DOMAIN} \\"
echo "     --agree-tos --email ${EMAIL} --cert-name ${DOMAIN}-0001"
echo ""
echo "B) Standart HTTP-01 challenge orqali (Faqat aniq domenlar uchun):"
echo "   certbot certonly --webroot -w /var/www/certbot \\"
echo "     -d ${DOMAIN} -d www.${DOMAIN} -d admin.${DOMAIN} -d app.${DOMAIN} \\"
echo "     --agree-tos --email ${EMAIL} --cert-name ${DOMAIN}-0001"
echo "------------------------------------------------------------------------"

echo ">>> [4/4] Sertifikat olingach, Nginx ni qayta yuklash buyrug'i:"
echo "   docker compose exec nginx nginx -s reload"
echo ""
echo ">>> Tayyor!"

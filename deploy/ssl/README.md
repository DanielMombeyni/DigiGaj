# Cloudflare Origin SSL (optional)

## فایل‌های اصلی (همان __SSL_CERT__ / __SSL_KEY__ در nginx)

| فایل | نقش |
|------|-----|
| `ssl-certificate.pem` | گواهی — معادل `__SSL_CERT__` |
| `ssl-private.key` | کلید خصوصی — معادل `__SSL_KEY__` |

1. گواهی را از Cloudflare بگیرید: **SSL/TLS → Origin Server → Create Certificate**
2. محتوای کامل PEM را در `ssl-certificate.pem` بچسبانید (شامل `-----BEGIN CERTIFICATE-----`)
3. کلید خصوصی را در `ssl-private.key` بچسبانید (شامل `-----BEGIN PRIVATE KEY-----`)
4. پروداکشن را ری‌استارت کنید: `./docker.sh prod restart proxy backend`

تا وقتی PEM معتبر در این دو فایل نباشد، سایت فقط روی **HTTP (پورت 80)** بالا می‌آید.

## نمونه

```bash
cp ssl-certificate.pem.example ssl-certificate.pem
cp ssl-private.key.example ssl-private.key
# سپس محتوای واقعی Cloudflare را در هر دو فایل جایگزین کنید
```

## نام‌های جایگزین (قدیمی)

همچنان پشتیبانی می‌شود: `origin.pem` + `origin.key` و چند نام دیگر.

# راهنمای استقرار Production — دیجی گج

این سند مراحل کامل اجرای فروشگاه **دیجی گج** روی سرور واقعی (Production) را توضیح می‌دهد.

---

## فهرست

1. [معماری](#معماری)
2. [پیش‌نیازها](#پیش‌نیازها)
3. [آماده‌سازی سرور](#آماده‌سازی-سرور)
4. [تنظیم فایل `.env`](#تنظیم-فایل-env)
5. [SSL و Cloudflare](#ssl-و-cloudflare)
6. [استقرار اولیه](#استقرار-اولیه)
7. [دستورات `docker.sh`](#دستورات-dockersh)
8. [تنظیمات خودکار (Auto Deploy)](#تنظیمات-خودکار-auto-deploy)
9. [کاربر ادمین اولیه](#کاربر-ادمین-اولیه)
10. [Seed و داده اولیه](#seed-و-داده-اولیه)
11. [به‌روزرسانی و نگهداری](#به‌روزرسانی-و-نگهداری)
12. [پشتیبان‌گیری](#پشتیبان‌گیری)
13. [عیب‌یابی](#عیب‌یابی)
14. [چک‌لیست امنیتی](#چک‌لیست-امنیتی)

---

## معماری

در Production همه درخواست‌های عمومی از **nginx (proxy)** عبور می‌کنند:

```mermaid
flowchart LR
  User[کاربر / Cloudflare] --> Proxy[proxy :80 / :443]
  Proxy -->|"/"| Frontend[frontend React]
  Proxy -->|"/api/* /admin/* /static/*"| Backend[backend Daphne :8000]
  Proxy -->|"/media/*"| Media[(media_prod)]
  Backend --> DB[(PostgreSQL)]
  Backend --> Redis[(Redis)]
  Backend --> Media
  Celery[celery + beat] --> Redis
  Celery --> DB
```

| سرویس | نقش | پورت عمومی |
|--------|-----|------------|
| **proxy** | nginx — SSL، مسیریابی | **80**, **443** |
| **frontend** | UI فروشگاه (React) | داخلی |
| **backend** | API Django/DRF + Admin | داخلی |
| **db** | PostgreSQL | داخلی |
| **redis** | Cache / Celery broker | داخلی |
| **celery** | Worker پس‌زمینه | داخلی |
| **celery-beat** | زمان‌بند Celery | داخلی |

فرانت‌اند API را از مسیر نسبی **`/api/v1`** صدا می‌زند؛ بنابراین روی هر دامنه/IP بدون build مجدد کار می‌کند.

---

## پیش‌نیازها

### سخت‌افزار (حداقل پیشنهادی)

- 2 vCPU
- 4 GB RAM
- 20 GB فضای دیسک

### نرم‌افزار روی سرور

- **Docker** 24+ و **Docker Compose** v2
- Git
- پورت‌های **80** و **443** باز (فایروال / Security Group)

### دامنه

- دامنه اصلی پروژه: **`digigadg.com`**
- DNS (ترجیحاً Cloudflare) به IP سرور اشاره کند

---

## آماده‌سازی سرور

### 1. دریافت کد

```bash
git clone <repository-url> store
cd store
```

### 2. ساخت فایل محیط

اگر `.env` وجود ندارد، اسکریپت کمکی خودکار از `.env.example` کپی می‌گیرد:

```bash
cp .env.example .env
```

### 3. ویرایش `.env` برای Production

حداقل این موارد را **حتماً** عوض کنید:

```env
DJANGO_SECRET_KEY=<یک-رشته-تصادفی-طولانی-و-امن>
POSTGRES_PASSWORD=<رمز-قوی-دیتابیس>
```

`DJANGO_ENV` و `AUTO_DEPLOY_CONFIG` در `docker-compose.prod.yml` از قبل روی production تنظیم شده‌اند.

---

## تنظیم فایل `.env`

| متغیر | توضیح | Production |
|--------|--------|------------|
| `DJANGO_SECRET_KEY` | کلید امن Django | **الزامی — یکتا و محرمانه** |
| `POSTGRES_PASSWORD` | رمز PostgreSQL | **الزامی — قوی** |
| `SITE_DOMAIN` | دامنه سایت | `digigadg.com` (پیش‌فرض در compose) |
| `AUTO_DEPLOY_CONFIG` | تشخیص خودکار IP/دامنه | `1` (در compose) |
| `PUBLIC_API_BASE` | آدرس عمومی API و تصاویر | خودکار از دامنه — مقدار `localhost` در production نادیده گرفته می‌شود |
| `FRONTEND_URL` | آدرس فرانت | معمولاً خودکار — `localhost` در production نادیده گرفته می‌شود |
| `TLS_ENABLED` | HTTPS فعال | خودکار اگر گواهی SSL باشد |

متغیرهای اختیاری:

```env
EXTRA_ALLOWED_HOSTS=api.digigadg.com
EXTRA_CORS_ORIGINS=https://api.digigadg.com
```

---

## SSL و Cloudflare

### DNS در Cloudflare

1. رکورد **A** برای `digigadg.com` → IP سرور
2. رکورد **A** یا **CNAME** برای `www` → همان مقصد (اختیاری)
3. حالت SSL پیشنهادی: **Full (strict)** — نیاز به Origin Certificate روی سرور

### فایل‌های گواهی روی سرور

دو فایل در پوشه `deploy/ssl/`:

| فایل | معادل nginx |
|------|-------------|
| `deploy/ssl/ssl-certificate.pem` | `__SSL_CERT__` |
| `deploy/ssl/ssl-private.key` | `__SSL_KEY__` |

**مراحل:**

1. در Cloudflare: **SSL/TLS → Origin Server → Create Certificate**
2. گواهi PEM را در `ssl-certificate.pem` بچسبانید (با `-----BEGIN CERTIFICATE-----`)
3. کلید خصوصی را در `ssl-private.key` بچسبانید (با `-----BEGIN PRIVATE KEY-----`)

```bash
cp deploy/ssl/ssl-certificate.pem.example deploy/ssl/ssl-certificate.pem
cp deploy/ssl/ssl-private.key.example deploy/ssl/ssl-private.key
# سپس محتوای واقعی Cloudflare را جایگزین کنید
```

### رفتار خودکار SSL

| وضعیت فایل‌ها | نتیجه |
|----------------|--------|
| PEM معتبر در هر دو فایل | HTTPS روی **443** + ریدایرکت 80→443 |
| فایل خالی یا فقط کامنت | فقط **HTTP** روی پورت **80** |

> فایل‌های واقعی گواهی در `.gitignore` هستند — روی git commit **نکنید**.

---

## استقرار اولیه

یک دستور برای بالا آوردن کل stack:

```bash
chmod +x docker.sh
./docker.sh Production up
```

این دستور:

1. در صورت نبود `.env` آن را از `.env.example` می‌سازد
2. Imageها را build می‌کند (در صورت نیاز)
3. همه سرویس‌ها را در پس‌زمینه start می‌کند
4. در **اولین اجرای backend** به‌صورت خودکار:
   - Migration دیتابیس
   - `collectstatic`
   - تشخیص IP/دامنه و تنظیم `ALLOWED_HOSTS`, CORS, CSRF
   - Seed bootstrap (یک‌بار)
   - Seed دمو کatalog (یک‌بار، چون `RUN_SEED=1`)

بعد از اتمام:

```bash
./docker.sh Production ps
./docker.sh Production logs backend
./docker.sh Production logs proxy
```

### آدرس‌های دسترسی

| بخش | آدرس |
|-----|------|
| فروشگاه | `https://digigadg.com` یا `http://IP_SERVER` |
| پنل مدیریت | `/panel-dashboard` |
| API | `/api/v1/` |
| Django Admin | `/admin/` |
| Swagger | `/api/docs/` |

---

## دستورات `docker.sh`

```text
./docker.sh Production <command> [args]
```

| دستور | کاربرد |
|--------|--------|
| **`up`** | Start + build در صورت نیاز. Migrate/seed خودکار در entrypoint (seed فقط یک‌بار) |
| **`rebuild`** | Build از صفر (`--no-cache`) + recreate همه containerها |
| **`restart`** | ری‌استارت — همه سرویس‌ها یا فقط سرویس‌های named |
| **`down`** | توقف stack |
| **`logs [svc]`** | مشاهده لاگ (مثلاً `logs backend`) |
| **`ps`** | وضعیت containerها |
| **`shell`** | Shell داخل backend |
| **`manage <cmd>`** | `python manage.py ...` |
| **`migrate`** | اجرای migration دستی |
| **`seed`** | اجرای اجباری bootstrap |
| **`seed-demo`** | اجرای اجباری کاتالوگ دمو |
| **`prune`** | حذف volumeها ⚠️ داده از بین می‌رود |

### مثال‌ها

```bash
# استقرار / بالا آوردن
./docker.sh Production up

# بعد از تغییر کد — build کامل
./docker.sh Production rebuild

# ری‌استارت فقط nginx و backend
./docker.sh Production restart proxy backend

# لاگ زنده
./docker.sh Production logs proxy

# ساخت superuser اضافه
./docker.sh Production manage createsuperuser
```

---

## تنظیمات خودکار (Auto Deploy)

با `AUTO_DEPLOY_CONFIG=1` (پیش‌فرض Production) این موارد **خودکار** تنظیم می‌شوند:

- **`ALLOWED_HOSTS`**: `digigadg.com`, `www.digigadg.com`, IP عمومی سرور, IP لوکال, hostname
- **`CORS_ALLOWED_ORIGINS`** / **`CSRF_TRUSTED_ORIGINS`**: بر اساس http/https و دامنه/IP
- **`PUBLIC_API_BASE`** / **`FRONTEND_URL`**: `https://digigadg.com` یا `http://...` بسته به SSL
- **`TLS_ENABLED`**: اگر فایل‌های SSL معتبر باشند

اسکریپت تشخیص: `backend/scripts/detect_deploy_env.py`  
خروجی ذخیره می‌شود در: `backend/runtime/deploy.env`

غیرفعال کردن:

```env
AUTO_DEPLOY_CONFIG=0
```

---

## کاربر ادمین اولیه

با اولین **bootstrap seed** این کاربر ساخته می‌شود:

| فیلد | مقدار |
|------|--------|
| نام کاربری | `daniel` |
| ایمیل | `mombeyni.daniel@gmail.com` |
| موبایل | `09001362211` |
| رمز | `admin@1234` |
| دسترسی | staff + superuser |

ورود از:
- پنل: `/panel-dashboard/login`
- با **شماره، ایمیل یا نام کاربری** (هر سه فعال است)

> **بعد از اولین ورود رمز را عوض کنید.**

---

## Seed و داده اولیه

| Seed | محتوا | تکرار |
|------|--------|--------|
| **bootstrap** | کاربر ادمین، تنظیمات سایت، صفحات CMS پایه | فقط **یک‌بار** (مگر `--force`) |
| **demo** | دسته‌بندی‌ها، محصولات نمونه، بنر | فقط **یک‌بار** (مگر `--force`) |

وضعیت در دیتابیس (`deploy_seed_state`) ذخیره می‌شود.  
ری‌استارت container باعث seed مجدد **نمی‌شود**.

اجرای دستی اجباری:

```bash
./docker.sh Production seed
./docker.sh Production seed-demo
```

---

## به‌روزرسانی و نگهداری

### تغییرات کد (بدون تغییر Dockerfile)

```bash
git pull
./docker.sh Production rebuild
```

### تغییر فقط تنظیمات nginx یا SSL

```bash
./docker.sh Production restart proxy
```

### Migration جدید

Migration در entrypoint backend اجرا می‌شود. برای اجرای دستی:

```bash
./docker.sh Production migrate
```

یا:

```bash
./docker.sh Production restart backend
```

### مشاهده وضعیت

```bash
./docker.sh Production ps
./docker.sh Production logs backend --tail=100
```

---

## پشتیبان‌گیری

### دیتابیس

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U gadget gadgetstore > backup_$(date +%F).sql
```

### فایل‌های media

Volume `media_prod` — از مسیر volume Docker یا:

```bash
docker compose -f docker-compose.prod.yml exec backend tar -czf - /app/media > media_backup.tar.gz
```

### بازیابی دیتابیس

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U gadget gadgetstore
```

---

## عیب‌یابی

### سایت باز نمی‌شود

```bash
./docker.sh Production ps          # همه سرویس Up هستند؟
./docker.sh Production logs proxy  # nginx خطا دارد؟
./docker.sh Production logs backend
```

- پورت 80/443 روی سرور باز باشد
- Cloudflare Proxy نباید پورت اشتباه forward کند

### تصاویر آپلودشده لود نمی‌شوند

در Production فایل‌های `/media/` را **nginx** از volume `media_prod` سرو می‌کند، نه Django.

```bash
./docker.sh Production restart proxy
curl -I https://digigadg.com/media/products/<filename>
```

- پاسخ باید `200` باشد، نه `404`
- اگر `.env` از example کپی شده و `PUBLIC_API_BASE=http://localhost:8000` مانده، بعد از به‌روزرسانی backend آن را با دامنه جایگزین می‌کند — یک‌بار `./docker.sh Production restart backend` بزنید

### خطای DisallowedHost

- `AUTO_DEPLOY_CONFIG=1` باشد
- دامنه در `SITE_DOMAIN` یا `EXTRA_ALLOWED_HOSTS` باشد
- `./docker.sh Production restart backend`

### SSL کار نمی‌کند

- فایل‌ها PEM کامل باشند (نه فقط کامنت)
- `./docker.sh Production logs proxy` → باید `HTTPS enabled` ببینید
- `./docker.sh Production restart proxy backend`

### API 502 / 504

```bash
./docker.sh Production logs backend
./docker.sh Production restart backend
```

### Seed اجرا نشده

```bash
./docker.sh Production logs backend | grep -i seed
./docker.sh Production seed
./docker.sh Production seed-demo
```

### پاک‌سازی کامل (⚠️ حذف داده)

```bash
./docker.sh Production down
./docker.sh Production prune
./docker.sh Production up
```

---

## چک‌لیست امنیتی

- [ ] `DJANGO_SECRET_KEY` تصادفی و یکتا
- [ ] `POSTGRES_PASSWORD` قوی
- [ ] رمز کاربر bootstrap بعد از deploy عوض شده
- [ ] فایل‌های `deploy/ssl/*.pem` و `*.key` commit نشده‌اند
- [ ] فایروال: فقط 80, 443 (و SSH) باز باشد
- [ ] Cloudflare: WAF / Rate limiting فعال (پیشنهادی)
- [ ] پشتیبان دوره‌ای دیتابیس

---

## ساختار فایل‌های مرتبط

```text
store/
├── docker.sh                    # دستورات dev/prod
├── docker-compose.prod.yml      # تعریف سرویس‌های Production
├── .env                         # تنظیمات محرمانه (روی git نیست)
├── deploy/
│   ├── nginx/                   # پیکربندی proxy
│   └── ssl/                     # گواهi Cloudflare
├── backend/
│   ├── scripts/entrypoint.sh    # migrate, seed, deploy detect
│   └── scripts/detect_deploy_env.py
└── docs/
    └── production.md            # همین سند
```

---

## پشتیبانی سریع

| مشکل | دستور |
|------|--------|
| بالا نیامدن | `./docker.sh Production up` |
| Build مجدد | `./docker.sh Production rebuild` |
| ری‌استارت | `./docker.sh Production restart` |
| لاگ | `./docker.sh Production logs <service>` |

برای محیط توسعه محلی از `./docker.sh dev up` استفاده کنید.

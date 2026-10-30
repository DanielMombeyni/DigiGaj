# راهنمای استقرار سرور دیجی‌گج — برای مبتدیان

این راهنما قدم‌به‌قدم توضیح می‌دهد چطور فروشگاه **دیجی‌گج** را روی یک سرور واقعی بالا بیاورید. فرض می‌کنیم قبلاً سایت استقرار نداده‌اید.

| سند مرتبط | نقش |
|-----------|-----|
| [چک‌لیست عملیاتی](./server-deployment-checklist.md) | تیک‌زدن قبل و بعد از هر مرحله |
| [محدودیت‌های شناخته‌شده](./server-deployment-known-limitations.md) | چیزهایی که هنوز در مخزن اثبات نشده‌اند |
| [production.md](./production.md) | مرجع فنی کوتاه‌تر برای اپراتور آشنا با Docker |

> **وضعیت این راهنما:** بر اساس بازرسی فقط‌خواندنی مخزن نوشته شده است. **اجرای واقعی روی سرور Production در این سند اثبات نشده است.** اگر هر مقداری را ندارید، **متوقف شوید** و از مالک پروژه یا مدیر سرور بپرسید — حدس نزنید.

---

## فهرست

1. [مفاهیم به زبان ساده](#1-مفاهیم-به-زبان-ساده)
2. [معماری واقعی دیجی‌گج](#2-معماری-واقعی-دیجی‌گج)
3. [برچسب‌های ترمینال](#3-برچسب‌های-ترمینال)
4. [پیش‌نیازها (قبل از هر دستور تغییر‌دهنده)](#4-پیش‌نیازها)
5. [دو اسکریپت استقرار — تفاوت مهم](#5-دو-اسکریپت-استقرار)
6. [دستورات خطرناک](#6-دستورات-خطرناک)
7. [دروازه ۱ — آماده‌سازی](#7-دروازه-۱--آماده‌سازی)
8. [دروازه ۲ — فایل محیط `.env`](#8-دروازه-۲--فایل-محیط-env)
9. [دروازه ۳ — دامنه، شبکه و TLS](#9-دروازه-۳--دامنه-شبکه-و-tls)
10. [دروازه ۴ — اولین راه‌اندازی Production](#10-دروازه-۴--اولین-راه‌اندازی-production)
11. [دروازه ۵ — تأیید بعد از شروع](#11-دروازه-۵--تأیید-بعد-از-شروع)
12. [به‌روزرسانی، migration، پشتیبان و برگشت](#12-به‌روزرسانی-migration-پشتیبان-و-برگشت)
13. [دیتابیس تست SMS (صادقانه)](#13-دیتابیس-تست-sms)
14. [عیب‌یابی ایمن](#14-عیب‌یابی-ایمن)
15. [وقتی باید متوقف شوید](#15-وقتی-باید-متوقف-شوید)

---

## 1. مفاهیم به زبان ساده

| مفهوم | توضیح کوتاه |
|--------|-------------|
| **سرور** | کامپیوتری همیشه روشن که سایت را به اینترنت نشان می‌دهد. مثل مغازه‌ای که در شهر اجاره کرده‌اید. |
| **Git** | ابزار نگه داشتن تاریخچه کد. با آن نسخهٔ درست کد را از مخزن می‌گیرید. |
| **Docker** | جعبه‌هایی جداگانه برای هر بخش برنامه (API، سایت، دیتابیس، …) تا روی سرور یکسان بالا بیایند. |
| **Compose** | فایل فهرستی از همان جعبه‌ها و ارتباطشان (`docker-compose.prod.yml`). |
| **دیتابیس (PostgreSQL)** | انبار سفارش‌ها، کاربران، محصولات. پاک کردنش مثل دور ریختن دفتر حساب است. |
| **Redis** | حافظهٔ سریع برای صف کارها و کش. |
| **Celery / Beat** | کارگر پس‌زمینه و زمان‌بند (مثلاً کارهای زمان‌بندی‌شده). |
| **فایل `.env`** | فهرست تنظیمات و رمزها. مثل کلید گاوصندوق — در مستندات عمومی رمز واقعی ننویسید. |
| **Migration** | دستور تغییر ساختار یا دادهٔ دیتابیس. **برگشت کد، migration را خودکار برنمی‌گرداند.** |
| **دامنه / DNS** | نام سایت (مثلاً `digigadg.ir`) و اشاره‌اش به IP سرور. |
| **TLS / گواهی SSL** | قفل HTTPS تا ارتباط رمزگذاری شود. |
| **پشتیبان (Backup)** | کپی قابل بازیابی از دیتابیس و فایل‌های آپلود؛ قبل از تغییر خطرناک الزامی است. |
| **Development / Production** | محیط توسعه روی کامپیوتر شما در برابر سایت واقعی مشتریان. **هرگز دستورات این دو را اشتباه نگیرید.** Staging رسمی در این مخزن تعریف نشده است. |

### قیاس کلی

دیجی‌گج مثل یک فروشگاه است: **ویترین** (فرانت React)، **انبار و حسابداری** (دیتابیس)، **صندوق و API** (بک‌اند Django)، **درب ورودی** (nginx / proxy)، و **کارمندان پشت صحنه** (Celery). Docker همه این اتاق‌ها را با یک نقشه (`docker-compose.prod.yml`) روشن می‌کند.

---

## 2. معماری واقعی دیجی‌گج

یافته‌های تأییدشده از مخزن (نه از سرور زنده):

| جزء | فناوری در مخزن | نقش | اگر نباشد چه می‌شود |
|-----|----------------|-----|---------------------|
| Backend | Django / DRF + Daphne ASGI | API، ادمین، منطق سفارش | سایت داده نمی‌گیرد |
| Frontend | React / Vite | فروشگاه و پنل | صفحه خالی یا 502 از proxy |
| PostgreSQL 16 | سرویس `db` | داده پایدار | backend بالا نمی‌آید |
| Redis 7 | سرویس `redis` | کش و صف Celery | کارگرها کار نمی‌کنند |
| Celery + Beat | worker و زمان‌بند | کارهای پس‌زمینه | SMS صف، زمان‌بندی، … ممکن است متوقف شوند |
| proxy | nginx | ورودی 80/443، مسیر `/` و `/api` | از بیرون سایت دیده نمی‌شود |
| SSL | Cloudflare Origin در `deploy/ssl/` | HTTPS | بدون PEM معتبر فقط HTTP روی 80 |
| SMS | Signal (متغیرهای `SIGNAL_SMS_*`) | پیامک | سفارش می‌ماند؛ SMS نمی‌رود |
| پرداخت | درایورهایی مثل PayPing / Zibal | درگاه | پرداخت آنلاین کار نمی‌کند |

```mermaid
flowchart LR
  User[کاربر یا Cloudflare] --> Proxy[proxy nginx :80/:443]
  Proxy -->|"/"| FE[frontend React]
  Proxy -->|"/api /admin /static"| BE[backend Daphne :8000]
  Proxy -->|"/media"| Media[(volume media_prod)]
  BE --> DB[(PostgreSQL)]
  BE --> Redis[(Redis)]
  Celery[celery + beat] --> Redis
  Celery --> DB
```

**توضیح ساده:** کاربر اول به nginx می‌رسد. صفحه فروشگاه از frontend می‌آید؛ API از backend. Backend به PostgreSQL و Redis وصل است. Celery از Redis کار می‌گیرد و به همان دیتابیس وصل می‌شود.

دامنهٔ پیش‌فرض در `docker-compose.prod.yml`: **`digigadg.ir`**. اگر دامنه واقعی شما چیز دیگری است، **قبل از استقرار** از مالک پروژه تأیید بگیرید — این راهنما دامنه را حدس نمی‌زند.

---

## 3. برچسب‌های ترمینال

قبل از هر دستور، برچسب را بخوانید:

| برچسب | معنی |
|--------|------|
| `[LOCAL COMPUTER]` | پایانه روی لپ‌تاپ/کامپیوتر خودتان |
| `[SERVER]` | پایانه‌ای که با SSH به سرور وصل شده‌اید |
| `[PROJECT ROOT]` | ریشهٔ مخزن؛ جایی که فایل‌های `docker.sh` و `docker-compose.prod.yml` دیده می‌شوند |
| `[BACKEND DIRECTORY]` | پوشهٔ `backend/` داخل مخزن |

**چطور بفهمید در ریشهٔ پروژه هستید؟**

```bash
# [SERVER] یا [LOCAL COMPUTER] — در پوشه‌ای که فکر می‌کنید ریشه است:
ls docker.sh docker-compose.prod.yml .env.example
```

موفقیت: هر سه نام چاپ می‌شوند. اگر «No such file» دیدید، هنوز در پوشهٔ درست نیستید — **متوقف شوید** و مسیر را از مدیر سرور بپرسید.

---

## 4. پیش‌نیازها

هیچ دستور تغییر‌دهنده‌ای را قبل از تکمیل این جدول اجرا نکنید.

| مورد | منبع تأیید | وضعیت در مخزن |
|------|------------|----------------|
| URL مخزن Git تأییدشده | مالک پروژه | **Must be supplied by owner** — در docs فقط `<repository-url>` آمده |
| شاخه و revision تأییدشده برای استقرار | مالک پروژه | **Must be supplied by owner** |
| IP یا hostname سرور + حساب SSH مجاز | مدیر سرور | **Must be confirmed by admin** |
| سیستم‌عامل سرور و دسترسی sudo/Docker | مدیر سرور | **Must be confirmed by admin** |
| Docker Engine 24+ و Compose v2 | `docs/production.md` | **Confirmed by repository** (نیاز به نصب واقعی روی سرور: admin) |
| حداقل منابع پیشنهادی: 2 vCPU، 4 GB RAM، 20 GB دیسک | `docs/production.md` | **Confirmed by repository** به‌عنوان پیشنهاد؛ اندازهٔ واقعی سرور: admin |
| مالکیت دامنه و رکورد DNS | مالک + Cloudflare/DNS | **Must be supplied by owner** / **admin** |
| فایل‌های Origin Certificate | `deploy/ssl/README.md` | روش **Confirmed**؛ فایل واقعی **Must be supplied by owner** |
| مقادیر محرمانه `.env` | `.env.example` (فقط نام‌ها) | کلیدها **Confirmed**؛ مقادیر **Must be supplied by owner** |
| مقصد پشتیبان و دسترسی restore | — | **Must be confirmed by admin** |
| اعتبار SMS / پرداخت / Google / Telegram | `.env.example` + پنل ادمین | **Must be supplied by owner** |
| تأیید کتبی مالک برای Production و migration | — | **Must be supplied by owner** |
| وجود Staging جدا | — | **Not currently verified** — در مخزن تعریف رسمی ندارد |

اگر حتی یک ردیف «Must …» خالی است: **استقرار را شروع نکنید.**

---

## 5. دو اسکریپت استقرار

| | Linux / macOS / Git Bash روی سرور | PowerShell (معمولاً ویندوز) |
|--|-----------------------------------|------------------------------|
| فایل | `./docker.sh` | `.\docker.ps1` |
| نام محیط Production | `Production` (همچنین `production` / `prod` پذیرفته می‌شود) | فقط `prod` |
| نام محیط توسعه | `dev` | `dev` |
| دستور `up` | `up -d --build` | `up -d` (**بدون** `--build`) |
| `seed` | `seed_bootstrap --force` | `seed_demo` (**رفتار متفاوت**) |
| `seed-demo` | دارد | **ندارد** |
| پیام URL بعد از prod `up` | دامنه / IP طبق اسکریپت | در کد فعلی `localhost:8080` چاپ می‌شود — با compose واقعی Production (پورت 80/443) **هم‌خوان نیست** |

**توصیه این راهنما برای سرور لینوکس Production:** از `./docker.sh` و نام محیط **`Production`** استفاده کنید.

`docker-compose.sms-test.yml` فقط برای Postgres تست SMS است و **جزو مسیر استقرار سایت نیست**.

---

## 6. دستورات خطرناک

| دستور | معنی واقعی در اسکریپت | داده را پاک می‌کند؟ |
|--------|------------------------|---------------------|
| `down` | توقف و حذف containerها | معمولاً **خیر** (volume می‌ماند) |
| `rebuild` | build بدون cache + recreate | سرویس‌ها عوض می‌شوند؛ volume معمولاً می‌ماند؛ downtime دارد |
| `migrate` | اجرای migration روی دیتابیس | **ساختار/داده را تغییر می‌دهد** |
| `seed` / `seed-demo` | پر کردن دادهٔ اولیه (با `--force` در sh) | می‌تواند دادهٔ seed را بازنویسی کند |
| `prune` | `down -v --remove-orphans` | **بله — volumeها حذف می‌شوند** |
| `down -v` (مستقیم Compose) | مثل prune | **بله** |

> **هرگز** `prune` یا `down -v` را به‌عنوان «عیب‌یابی معمولی» اجرا نکنید. فقط با تأیید کتبی مالک و بعد از پشتیبان تأییدشده.

`up` در Production **بی‌ضرر نیست**: build/start می‌کند و entrypoint بک‌اند **`migrate --noinput`** و seedهای شرطی را اجرا می‌کند.

---

## 7. دروازه ۱ — آماده‌سازی

### گام 1.1 — تأیید دسترسی SSH

```text
[LOCAL COMPUTER]
```

از مالک/مدیر بخواهید: آدرس سرور، نام کاربری، روش کلید SSH. سپس:

```bash
ssh USERNAME@SERVER_ADDRESS
```

موفقیت: خط فرمان سرور را می‌بینید (مثلاً `user@hostname:~$`).  
شکست: پیام Permission denied / timed out → **متوقف شوید**؛ مدیر سرور را صدا بزنید. دستور را کورکورانه تکرار نکنید.

### گام 1.2 — بررسی Docker روی سرور

```bash
# [SERVER]
docker version
docker compose version
```

موفقیت: نسخه Engine و Compose چاپ می‌شود.  
شکست: Docker نیست → نصب را مدیر سرور انجام دهد. این راهنما نصب سیستم‌عامل را حدس نمی‌زند.

### گام 1.3 — فضای دیسک و پورت‌ها

```bash
# [SERVER]
df -h
ss -tlnp | head
```

پورت‌های عمومی Production در compose: **80** و **443**. اگر اشغال‌اند، قبل از `up` با مدیر هماهنگ کنید.

### گام 1.4 — دریافت کد با revision تأییدشده

```bash
# [SERVER] — مسیر را مدیر مشخص می‌کند؛ مثال فقط ساختار است
git clone APPROVED_REPOSITORY_URL store
cd store
git fetch --all
git checkout APPROVED_BRANCH
git rev-parse HEAD
```

`APPROVED_REPOSITORY_URL` و `APPROVED_BRANCH` و hash مورد انتظار را **مالک پروژه** می‌دهد.

موفقیت: `git rev-parse HEAD` با revision تأییدشده یکی است.

> **استقرار از working tree کثیف (فایل‌های commit‌نشده) توصیه نمی‌شود.**  
> در زمان نوشتن این راهنما، روی شاخهٔ کاری توسعه ممکن است migrationهای `0025`–`0028` هنوز **untracked** باشند. یک `git clone` تمیز از remote آن‌ها را **نخواهد داشت** مگر مالک آن‌ها را commit و برای استقرار تأیید کرده باشد. قبل از ادامه: از مالک بپرسید «کدام commit شامل migrationهای لازم است؟»

### گام 1.5 — تأیید پوشهٔ ریشه

```bash
# [SERVER] [PROJECT ROOT]
pwd
ls docker.sh docker-compose.prod.yml docker-compose.dev.yml
```

### گام 1.6 — پشتیبان و برنامه migration

اگر روی سرور **از قبل** دیتابیس زنده دارید:

1. از مالک تأیید migration بگیرید.
2. پشتیبان بگیرید و **باز بودن فایل backup را روی همان ماشین یا مقصد تأییدشده چک کنید** (بخش ۱۲).
3. وضعیت فعلی migration سرور را فقط با روش تأییدشدهٔ مالک/مدیر بخوانید (مثلاً بعد از بالا بودن stack: `./docker.sh Production manage showmigrations app`). این راهنما به دیتابیس زنده وصل نمی‌شود.

اگر پیش‌نیازی نامشخص است: **قبل از اولین دستور تغییر‌دهنده متوقف شوید.**

---

## 8. دروازه ۲ — فایل محیط `.env`

### ترتیب بارگذاری (تأییدشده در کد)

از `backend/config/settings/components/base.py`:

1. متغیرهایی که از قبل در محیط process هستند اولویت دارند (معمولاً بخش `environment:` در Compose برای سرویس).
2. سپس فایل ریشه: `.env` در `[PROJECT ROOT]`.
3. سپس `backend/.env` با `overwrite=False` (فقط کلیدهای خالی را پر می‌کند).
4. سپس در صورت وجود: `backend/runtime/deploy.env` با `overwrite=False` (اغلب پس از `detect_deploy_env.py` در Production).

اسکریپت‌های `docker.sh` / `docker.ps1` اگر `.env` نباشد، از `.env.example` کپی می‌کنند. **این کپی به‌تنهایی Production امن نیست.**

### گام 2.1 — ساخت فایل (بدون چاپ رمز)

```bash
# [SERVER] [PROJECT ROOT]
cp .env.example .env
```

سپس با ویرایشگر امن (مثلاً `nano .env`) مقادیری را که **مالک پروژه** داده جایگزین کنید. حداقل:

| نام متغیر | چرا |
|-----------|-----|
| `DJANGO_SECRET_KEY` | کلید امنیتی Django — باید تصادفی و محرمانه باشد |
| `POSTGRES_PASSWORD` | رمز دیتابیس — قوی؛ با مقدار example یکی نماند |

نام‌های دیگر موجود در example (بدون مقدار واقعی در این سند):  
`POSTGRES_DB`, `POSTGRES_USER`, `SIGNAL_SMS_API_KEY`, `SIGNAL_SMS_FROM`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, …

### گام 2.2 — تأیید حضور کلیدها بدون نمایش مقدار

```bash
# [SERVER] [PROJECT ROOT]
grep -E '^(DJANGO_SECRET_KEY|POSTGRES_PASSWORD)=' .env | sed 's/=.*/=***hidden***/'
```

موفقیت: دو خط با `=***hidden***` می‌بینید و مقدار example قدیمی نیست (مالک تأیید می‌کند).  
هرگز خروجی خام `.env` را در چت یا تیکت عمومی paste نکنید.

در Production، `docker-compose.prod.yml` خودش `DJANGO_ENV=production` و دامنه/URLهای پیش‌فرض را برای سرویس‌ها ست می‌کند؛ باز هم رمزهای `.env` باید واقعی باشند.

---

## 9. دروازه ۳ — دامنه، شبکه و TLS

### آنچه در مخزن است

- پورت‌های proxy: `80:80` و `443:443`
- راهنمای Origin: `deploy/ssl/README.md`
- نمونه: `deploy/ssl/ssl-certificate.pem.example` و `ssl-private.key.example`
- فایل‌های واقعی گواهی معمولاً در git نیستند (درست است)

### آنچه باید مالک / مدیر بدهد

- تأیید دامنه نهایی و رکوردهای DNS (A/CNAME به IP سرور)
- حالت SSL در Cloudflare (در `production.md`: پیشنهاد Full strict)
- محتوای PEM گواهی و کلید Origin

### گام 3.1 — نصب گواهی (فقط روش تأییدشده در repo)

```bash
# [SERVER] [PROJECT ROOT]
cp deploy/ssl/ssl-certificate.pem.example deploy/ssl/ssl-certificate.pem
cp deploy/ssl/ssl-private.key.example deploy/ssl/ssl-private.key
```

سپس محتوای واقعی Cloudflare را در هر دو فایل جایگزین کنید (شروع با `-----BEGIN CERTIFICATE-----` و `-----BEGIN PRIVATE KEY-----`). کامنت راهنما گواهی حساب نمی‌شود.

اگر مالک هنوز PEM نداده: **HTTPS را تکمیل‌نشده بدانید**؛ می‌توانید بعداً فقط HTTP روی 80 داشته باشید — ولی استقرار کامل با HTTPS بدون این فایل‌ها **مسدود** است مگر مالک صریحاً HTTP موقت را تأیید کند.

تمدید خودکار TLS در مخزن به‌صورت runbook کامل **یافت نشد** — تمدید را از مالک/Cloudflare بپرسید.

---

## 10. دروازه ۴ — اولین راه‌اندازی Production

### هشدار مهم

دستور زیر:

- image می‌سازد و سرویس‌ها را بالا می‌آورد
- در entrypoint بک‌اند: **`python manage.py migrate --noinput`**
- `collectstatic`
- در Production با `AUTO_DEPLOY_CONFIG`: تشخیص محیط
- `seed_bootstrap --if-needed`
- با `RUN_SEED=1` در compose: `seed_demo --if-needed`

یعنی **داده و schema ممکن است تغییر کنند** و ممکن است **downtime** کوتاه داشته باشید.

فقط وقتی ادامه دهید که:

- [ ] پیش‌نیازهای بخش ۴ کامل است  
- [ ] `.env` توسط مالک بازبینی شده  
- [ ] پشتیبان/برنامه migration (اگر DB قبلی هست) تأیید شده  
- [ ] مالک کتباً «اجازهٔ Production up» داده  

### گام 4.1 — اجرا (لینوکس)

```bash
# [SERVER] [PROJECT ROOT]
chmod +x docker.sh
./docker.sh Production up
```

موفقیت تقریبی: پیام `✓ Production stack is up` و جدول `ps`؛ سرویس‌ها در حال اجرا.

شکست: خطا در build یا exit غیرصفر → **دستور را بی‌هدف تکرار نکنید.** لاگ بگیرید (دروازه ۵) و با مالک/مدیر هماهنگ کنید.

### اگر مجبورید از PowerShell روی ماشین ویندوز برای همان compose استفاده کنید

```powershell
# [SERVER یا ماشین هدف] [PROJECT ROOT]
.\docker.ps1 prod up
```

یادآوری: بدون `--build`؛ اگر image تازه لازم است، بهتر است `.\docker.ps1 prod rebuild` یا از `docker.sh` استفاده شود. پیام URL اسکریپت ps1 برای prod ممکن است گمراه‌کننده باشد — به پورت‌های واقعی compose (80/443) اعتماد کنید.

---

## 11. دروازه ۵ — تأیید بعد از شروع

این‌ها یکی نیستند: «فرآیند شروع شد» ≠ «سرویس سالم است» ≠ «سایت باز می‌شود» ≠ «کل فروشگاه درست کار می‌کند».

### 5.1 وضعیت container

```bash
# [SERVER] [PROJECT ROOT]
./docker.sh Production ps
```

موفقیت: سرویس‌های `db`, `redis`, `backend`, `frontend`, `proxy`, `celery`, `celery-beat` در حالت Up (و در صورت healthcheck، healthy).

### 5.2 لاگ‌ها

```bash
./docker.sh Production logs backend
# Ctrl+C برای خروج از دنبال‌کردن لاگ
./docker.sh Production logs proxy
```

موفقیت تقریبی: migrate بدون traceback؛ برای SSL معتبر در proxy نشانهٔ فعال بودن HTTPS طبق لاگ nginx (در `production.md`: عبارت مرتبط با HTTPS).

### 5.3 دیتابیس آماده‌بودن

Healthcheck در compose: `pg_isready` روی سرویس `db`. از `ps` وضعیت healthy را ببینید. به دیتابیس Production برای «تست دستی» وصل نشوید مگر مالک اجازه بدهد.

### 5.4 وب و API (از مرورگر یا curl)

آدرس‌ها طبق اسکریپت / docs (دامنه پیش‌فرض مخزن):

| بخش | مسیر |
|-----|------|
| فروشگاه | `/` روی دامنه یا `http://SERVER_IP` |
| پنل | `/panel-dashboard` |
| API | `/api/v1/` |
| Django Admin | `/admin/` |
| اسناد API | `/api/docs/` |

```bash
# [SERVER] — IP یا دامنه را از مالک بگیرید؛ مثال ساختاری:
curl -I http://SERVER_IP/
curl -I http://SERVER_IP/api/v1/
```

موفقیت تقریبی: پاسخ HTTP غیر از 502 برای صفحه اصلی (کد دقیق به تنظیمات بستگی دارد).  
502: معمولاً backend یا proxy؛ بخش عیب‌یابی.

### 5.5 Celery

```bash
./docker.sh Production logs celery
./docker.sh Production logs celery-beat
```

موفقیت تقریبی: worker بدون crash مکرر؛ beat در حال زمان‌بندی.

### 5.6 ورود ادمین

پس از bootstrap seed، یک کاربر staff ساخته می‌شود. **رمز پیش‌فرض را در این سند نمی‌نویسیم.** از مالک بخواهید و **بلافاصله بعد از اولین ورود عوض کنید.**

---

## 12. به‌روزرسانی، migration، پشتیبان و برگشت

### زنجیره migration (وضعیت کد در زمان نگارش)

```text
0024_sms_opt_out_suffix
  → 0025_sms_template_bindings_and_log_audit
  → 0026_sms_dispatch_claim
  → 0027_product_display_priority
  → 0028_sms_order_created_event
```

`0028` به `0027` وابسته است؛ ویژگی SMS event و اولویت نمایش محصول در یک زنجیره می‌آیند.

**یافتهٔ Git (باید قبل از هر استقرار دوباره چک شود):** فایل‌های `0025`–`0028` ممکن است هنوز در working tree **untracked** باشند. استقرار باید از **revision commit‌شده و تأییدشده** باشد که این فایل‌ها را دارد. Clone تمیز از remote بدون آن commitها، این migrationها را ندارد.

### پشتیبان دیتابیس (از `production.md` — روی سرور با stack بالا)

```bash
# [SERVER] [PROJECT ROOT]
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U gadget gadgetstore > backup_YYYY-MM-DD.sql
ls -la backup_YYYY-MM-DD.sql
```

نام کاربر/دیتابیس پیش‌فرض compose: `gadget` / `gadgetstore` — اگر در `.env` عوض شده، همان را به‌جای این‌ها بگذارید (از مالک بپرسید).

موفقیت: فایل backup اندازهٔ غیرصفر دارد.

### پشتیبان media

```bash
docker compose -f docker-compose.prod.yml exec backend tar -czf - /app/media > media_backup.tar.gz
```

### به‌روزرسانی کد (فقط بعد از تأیید مالک)

```bash
# [SERVER] [PROJECT ROOT]
git fetch
git checkout APPROVED_REVISION
# پشتیبان DB از قبل گرفته شده باشد
./docker.sh Production rebuild
```

`rebuild` و همچنین استارت مجدد backend می‌تواند دوباره **migrate** را از entrypoint اجرا کند.

### Migration دستی

```bash
./docker.sh Production migrate
```

فقط با تأیید مالک و بعد از backup.

### بازیابی دیتابیس (خطرناک — فقط اضطراری با تأیید)

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U gadget gadgetstore
```

### برگشت کد ≠ برگشت دیتابیس

اگر کد را به commit قبلی برگردانید، جدول‌ها و ستون‌های migration جدید **خودکار پاک نمی‌شوند**. برگشت schema نیاز به برنامهٔ جدا و تأیید مالک دارد. این مخزن runbook کامل reverse migration برای Production ارائه نکرده است.

### استقرار شکست‌خورده

1. لاگ: `./docker.sh Production logs backend` و `proxy`  
2. `prune` نزنید  
3. volume را پاک نکنید  
4. با پشتیبان تأییدشده و مالک تصمیم بگیرید  

---

## 13. دیتابیس تست SMS

هدف فایل `docker-compose.sms-test.yml`: یک Postgres جدا برای pytestهای نیازمند DB، با نام پروژهٔ Compose ثابت `digigaj-sms-test`، پورت میزبان `127.0.0.1:55432`، volume با نام `digigaj_sms_pytest_pgdata`.

متغیرهای مرتبط با گارد تست (جزئیات در `docs/sms-test-isolation.md`):

- `DIGIGAJ_SMS_TEST_DB`
- `DIGIGAJ_ALLOW_NON_SMS_TEST_DB`
- `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_HOST` / `POSTGRES_PORT`

### وضعیت اثبات runtime

```text
RUNTIME ISOLATION NOT PROVEN
```

تا وقتی شواهد واقعی runtime ثبت نشده، **تست‌های متصل به PostgreSQL، migration تست، یا دستوراتی که ممکن است به DB اشتباه وصل شوند را برای «تأیید isolation» اجرا نکنید.**

تست بدون نیاز به DB فقط وقتی مجاز است که مالک/توسعه‌دهنده صریحاً مجموعهٔ nodeهای بدون DB را مشخص کرده باشد. دستور کلی `./docker.sh Production test` یا `docker.ps1 … test` داخل stack اپ اجرا می‌شود و **می‌تواند به دیتابیس همان محیط وصل شود** — برای Production مناسب نیست.

اگر تست به دیتابیس اشتباه وصل شود، **می‌تواند داده را تغییر دهد.**

---

## 14. عیب‌یابی ایمن

برای هر مورد: ببینید → معنی رایج → بازرسی امن → موفقیت → قدم بعدی امن → کار ممنوع.

### Docker در دسترس نیست

- **می‌بینید:** `Cannot connect to the Docker daemon`  
- **معنی:** Engine روشن نیست یا دسترسی ندارید  
- **بازرسی:** `docker version`  
- **موفقیت:** نسخه چاپ می‌شود  
- **بعدی:** مدیر سرور / روشن کردن Docker Desktop  
- **ممنوع:** تکرار `up`؛ پاک کردن volume  

### SSH شکست

- **می‌بینید:** timeout / Permission denied  
- **بازرسی:** از شبکه درست وصل شده‌اید؟ کلید درست؟  
- **بعدی:** مدیر سرور  
- **ممنوع:** امتحان رمزهای تصادفی  

### پورت اشغال

- **می‌بینید:** `address already in use` برای 80/443  
- **بازرسی:** `ss -tlnp`  
- **بعدی:** مدیر مشخص کند کدام سرویس پورت را گرفته  
- **ممنوع:** `prune` برای «خالی کردن»  

### مقدار محیط کم است

- **می‌بینید:** خطا درباره SECRET یا اتصال DB  
- **بازرسی:** بخش ۲.۲ بدون چاپ رمز  
- **بعدی:** مالک مقادیر را بدهد و backend را restart کنید  
- **ممنوع:** کپی دوباره example روی `.env` واقعی بدون پشتیبان  

### Container unhealthy

- **بازرسی:** `./docker.sh Production ps` و `logs` همان سرویس  
- **بعدی:** بر اساس لاگ؛ اگر DB است `pg_isready` در healthcheck  
- **ممنوع:** `down -v`  

### Database connection refused

- **بازرسی:** وضعیت سرویس `db`؛ نام host در Production باید `db` داخل شبکه Docker باشد  
- **ممنوع:** عوض کردن به localhost روی سرور بدون درک شبکه Docker  

### دیتابیس اشتباه

- **معنی:** اتصال به dev یا sms-test به‌جای prod  
- **بازرسی:** کدام compose فایل و کدام project؛ هرگز sms-test را با prod یکی نکنید  
- **ممنوع:** migrate روی محیطی که مطمئن نیستید  

### شکست migration

- **بازرسی:** `./docker.sh Production logs backend`  
- **بعدی:** متوقف؛ backup؛ مالک/توسعه‌دهنده  
- **ممنوع:** تکرار بی‌هدف migrate؛ prune  

### HTTP 404 یا 502

- **بازرسی:** `logs proxy` و `logs backend`؛ `ps`  
- **502:** اغلب backend مرده است → restart کنترل‌شده با تأیید  
- **ممنوع:** حذف volume  

### فرانت به API اشتباه

- در Production، build فرانت با `VITE_API_BASE_URL=/api/v1` است (مسیر نسبی). اگر از build قدیمی/محیط دیگر استفاده می‌کنید، با مالک هماهنگ کنید.

### Celery کار نمی‌کند

- **بازرسی:** `logs celery` و `redis` healthy  
- **بعدی:** restart همان سرویس‌ها با تأیید؛ نه prune  

### SMS نمی‌رسد

- بررسی تنظیمات پنل و پر بودن `SIGNAL_SMS_*` توسط مالک؛ لاگ SMS در ادمین  
- این راهنما SMS واقعی ارسال نمی‌کند  

### شکست callback پرداخت

- لاگ backend؛ تنظیم درگاه در ادمین؛ URL بازگشت باید با دامنه عمومی درست باشد  
- تراکنش واقعی نزنید مگر مالک بگوید  

### فایل TLS نیست

- فقط HTTP روی 80؛ طبق بخش ۹ PEM بگذارید؛ `restart proxy backend`  
- PEM را commit نکنید  

### پر شدن دیسک

- **بازرسی:** `df -h`  
- **بعدی:** مدیر فضای دیسک  
- **ممنوع:** حذف volume دیتابیس به‌عنوان آزادسازی  

### شکست backup/restore

- **بازرسی:** اندازه فایل؛ خطاهای `pg_dump`/`psql`  
- **بعدی:** قبل از restore دوم، از سالم بودن backup مطمئن شوید؛ مالک تأیید کند  
- **ممنوع:** restore روی دیتابیس زنده بدون تأیید و بدون backup جدید از وضعیت فعلی  

---

## 15. وقتی باید متوقف شوید

- URL git، شاخه، یا revision را ندارید  
- SSH یا Docker کار نمی‌کند  
- رمزها و دامنه تأیید نشده‌اند  
- مالک اجازهٔ migrate / Production up نداده  
- migration لازم روی remote commit نشده و وضعیت untracked نامشخص است  
- backup قابل اعتماد ندارید  
- دستور شکست خورده و علت را نمی‌فهمید  

در همهٔ این حالت‌ها: **متوقف شوید، وضعیت را با لاگ غیرمحرمانه گزارش دهید، حدس نزنید، داده پاک نکنید.**

---

## پیوندهای بیشتر

- چک‌لیست: [server-deployment-checklist.md](./server-deployment-checklist.md)  
- محدودیت‌ها: [server-deployment-known-limitations.md](./server-deployment-known-limitations.md)  
- مرجع فنی: [production.md](./production.md)  
- SSL: [../deploy/ssl/README.md](../deploy/ssl/README.md)  
- isolation تست SMS: [sms-test-isolation.md](./sms-test-isolation.md)  

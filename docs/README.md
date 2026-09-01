# گجت‌استور

فروشگاه آنلاین خرید و فروش گجت با:

- **Backend:** Django 5, DRF, Channels, Celery, Redis, PostgreSQL, allauth, simplejwt, drf-spectacular, django-jalali
- **Frontend:** React + Vite + Tailwind + Axios + persian-tools
- **Payment:** Zarinpal, Zibal, PayPing, Card-to-card

## اجرای سریع با Docker

```bash
cp .env.example .env   # اگر .env ندارید
./docker.sh dev up
```

روی Windows (PowerShell):

```powershell
.\docker.ps1 dev up
```

| سرویس | آدرس |
|--------|------|
| فروشگاه | http://localhost:5173 |
| API | http://localhost:8000/api/v1/ |
| Swagger | http://localhost:8000/api/docs/ |
| Django Admin | http://localhost:8000/admin/ |

کاربر پیش‌فرض بعد از seed: `admin` / `admin1234`

## دستورات docker.sh

```text
./docker.sh dev up
./docker.sh dev down
./docker.sh dev rebuild
./docker.sh dev logs backend
./docker.sh dev manage makemigrations
./docker.sh dev migrate
./docker.sh dev seed
./docker.sh prod up
./docker.sh prod rebuild
./docker.sh prod down
```

## ساختار اصلی

- `backend/app/models/` — مدل‌های دامنه
- `backend/app/payment/` — هسته درگاه پرداخت
- `backend/app/services/` — منطق کسب‌وکار
- `frontend/src/pages/shop/` — صفحات عمومی
- `frontend/src/pages/admin/` — پنل مدیریت

جزئیات درگاه: [PAYMENT.md](./PAYMENT.md)

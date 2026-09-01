# سیستم درگاه پرداخت

معماری: **Driver + Registry + Facade + Service**

## مسیرها

| متد | مسیر | توضیح |
|-----|------|--------|
| GET | `/api/v1/payment/gateways/` | لیست درگاه‌های فعال (Auth) |
| POST | `/api/v1/payment/purchase/` | شروع پرداخت |
| POST | `/api/v1/payment/confirm/` | تأیید بعد از بازگشت |
| GET | `/api/v1/payment/status/<tracking>/` | وضعیت |
| GET/POST | `/api/v1/payment/callback/<provider>/` | Callback درگاه (عمومی) |
| GET | `/api/v1/payment/admin/catalog/` | کاتالوگ درایورها |
| GET/POST | `/api/v1/payment/admin/gateways/` | CRUD درگاه |
| PATCH/DELETE | `/api/v1/payment/admin/gateways/<id>/` | ویرایش/حذف |
| POST | `/api/v1/payment/admin/card-confirm/` | تأیید دستی کارت‌به‌کارت |

## نمونه credentials

### زرین‌پال
```json
{ "merchant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "sandbox": true }
```

### زیبال (تست)
```json
{ "merchant": "zibal" }
```

### پی‌پینگ
```json
{ "api_token": "YOUR_TOKEN", "currency": "T" }
```

### کارت‌به‌کارت
```json
{
  "card_number": "6037-xxxx-xxxx-xxxx",
  "card_holder": "نام صاحب حساب",
  "bank_name": "بانک نمونه",
  "instructions": "رسید را برای پشتیبانی بفرستید"
}
```

## نمونه curl

```bash
# لاگین
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin1234"}' | jq -r .access)

# لیست درگاه
curl -H "Authorization: Bearer $TOKEN" -H "X-Client-Platform: web" \
  "http://localhost:8000/api/v1/payment/gateways/?platform=web"

# خرید
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"gateway":"zarinpal","product_id":1,"platform":"web"}' \
  http://localhost:8000/api/v1/payment/purchase/
```

## افزودن درگاه جدید

1. فایل `backend/app/payment/drivers/mygateway.py` با ارث‌بری از `BasePaymentDriver`
2. ثبت در `ALL_DRIVERS` داخل `drivers/__init__.py`
3. افزودن choice به `PaymentGatewayConfig.Provider`
4. migration در صورت نیاز

هسته درگاه از منطق محصول جدا است؛ فعال‌سازی سفارش فقط از `PaymentService.activate` انجام می‌شود.

## env ضروری پروداکشن

```env
PUBLIC_API_BASE=https://api.example.com
APP_DEEP_LINK_SCHEME=gadgetstore
TLS_ENABLED=true
```

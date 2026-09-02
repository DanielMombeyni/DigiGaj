from __future__ import annotations

PLACEHOLDERS = (
    {"key": "store_name", "label": "نام فروشگاه"},
    {"key": "store_url", "label": "آدرس فروشگاه"},
    {"key": "customer_name", "label": "نام مشتری"},
    {"key": "customer_email", "label": "ایمیل مشتری"},
    {"key": "customer_phone", "label": "تلفن مشتری"},
    {"key": "order_number", "label": "شماره سفارش"},
    {"key": "order_status", "label": "وضعیت سفارش"},
    {"key": "previous_status", "label": "وضعیت قبلی"},
    {"key": "order_total", "label": "مبلغ کل"},
    {"key": "order_items", "label": "اقلام سفارش"},
    {"key": "order_address", "label": "آدرس ارسال"},
    {"key": "ticket_number", "label": "شماره تیکت"},
    {"key": "ticket_subject", "label": "موضوع تیکت"},
    {"key": "ticket_message", "label": "متن پیام تیکت"},
)

_WRAP = (
    '<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;'
    "max-width:560px;margin:0 auto;padding:24px;color:#1f2937;line-height:1.9;"
    'background:#f8fafc">'
    '<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e5e7eb">'
    "{inner}"
    "</div></div>"
)


def _html(inner: str) -> str:
    return _WRAP.format(inner=inner)


BUILTIN_TEMPLATES = (
    {
        "key": "order_created",
        "name": "ثبت سفارش",
        "event": "order_created",
        "subject": "سفارش {{order_number}} ثبت شد",
        "body_html": _html(
            "<p>سلام {{customer_name}}،</p>"
            "<p>سفارش شما با شماره <strong>{{order_number}}</strong> ثبت شد.</p>"
            "<p>اقلام:</p><p>{{order_items}}</p>"
            "<p>مبلغ کل: <strong>{{order_total}}</strong></p>"
            "<p>وضعیت فعلی: {{order_status}}</p>"
            "<p>{{store_name}}</p>"
        ),
        "sort_order": 10,
    },
    {
        "key": "order_paid",
        "name": "پرداخت موفق",
        "event": "order_paid",
        "subject": "پرداخت سفارش {{order_number}} تأیید شد",
        "body_html": _html(
            "<p>سلام {{customer_name}}،</p>"
            "<p>پرداخت سفارش <strong>{{order_number}}</strong> با موفقیت انجام شد.</p>"
            "<p>مبلغ: <strong>{{order_total}}</strong></p>"
            "<p>به‌زودی آماده‌سازی سفارش را شروع می‌کنیم.</p>"
            "<p>{{store_name}}</p>"
        ),
        "sort_order": 20,
    },
    {
        "key": "order_status_changed",
        "name": "تغییر وضعیت سفارش",
        "event": "order_status_changed",
        "subject": "وضعیت سفارش {{order_number}}: {{order_status}}",
        "body_html": _html(
            "<p>سلام {{customer_name}}،</p>"
            "<p>وضعیت سفارش <strong>{{order_number}}</strong> به‌روز شد.</p>"
            "<p>از {{previous_status}} به <strong>{{order_status}}</strong>.</p>"
            "<p>{{store_name}}</p>"
        ),
        "sort_order": 30,
    },
    {
        "key": "ticket_created",
        "name": "ثبت تیکت پشتیبانی",
        "event": "ticket_created",
        "subject": "تیکت {{ticket_number}} ثبت شد",
        "body_html": _html(
            "<p>سلام {{customer_name}}،</p>"
            "<p>تیکت پشتیبانی شما با شماره <strong>{{ticket_number}}</strong> ثبت شد.</p>"
            "<p>موضوع: {{ticket_subject}}</p>"
            "<p>به‌زودی پاسخ می‌دهیم.</p>"
            "<p>{{store_name}}</p>"
        ),
        "sort_order": 40,
    },
    {
        "key": "ticket_replied",
        "name": "پاسخ تیکت پشتیبانی",
        "event": "ticket_replied",
        "subject": "پاسخ جدید برای تیکت {{ticket_number}}",
        "body_html": _html(
            "<p>سلام {{customer_name}}،</p>"
            "<p>پاسخ جدیدی برای تیکت <strong>{{ticket_number}}</strong> ثبت شد.</p>"
            "<p>موضوع: {{ticket_subject}}</p>"
            "<p>{{ticket_message}}</p>"
            "<p>{{store_name}}</p>"
        ),
        "sort_order": 50,
    },
    {
        "key": "user_registered",
        "name": "خوش‌آمد ثبت‌نام",
        "event": "user_registered",
        "subject": "به {{store_name}} خوش آمدید",
        "body_html": _html(
            "<p>سلام {{customer_name}}،</p>"
            "<p>حساب شما در {{store_name}} ساخته شد.</p>"
            "<p>از خرید لذت ببرید.</p>"
            "<p>{{store_url}}</p>"
        ),
        "sort_order": 60,
    },
)

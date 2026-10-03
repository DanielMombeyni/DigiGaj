"""Editable About / Contact storefront content with rich defaults."""

from __future__ import annotations

from copy import deepcopy

from django.db import transaction
from rest_framework.exceptions import ValidationError

from app.models import SitePage, SiteSetting

ABOUT_KEY = "storefront_about"
CONTACT_KEY = "storefront_contact"
INFO_PAGES_ENABLE_REPAIR_KEY = "storefront_info_pages_enable_repair_v1"

DEFAULT_ABOUT = {
    "eyebrow": "درباره فروشگاه",
    "title": "دیجی‌گج؛ انتخاب هوشمند گجت",
    "subtitle": "از هدفون و ساعت هوشمند تا لوازم جانبی روز؛ با تمرکز روی اصالت کالا، قیمت شفاف و پشتیبانی واقعی.",
    "story": (
        "دیجی‌گج برای کسانی ساخته شده که خرید گجت را جدی می‌گیرند. ما به‌جای انبوه آگهی‌های مبهم، "
        "کاتالوگ گزیده‌ای از محصولات کاربردی ارائه می‌کنیم تا قبل از پرداخت بدانید دقیقاً چه چیزی "
        "می‌خرید، چه تضمینی دارید و چطور پیگیری می‌شود.\n\n"
        "تیم ما ترکیبی از علاقه به تکنولوژی و تجربه فروش آنلاین است؛ برای همین روی جزئیاتی مثل "
        "بسته‌بندی ایمن، وضعیت موجودی واقعی و پاسخ‌گویی بعد از خرید حساس هستیم. هدفمان این است "
        "که خرید گجت از یک تجربه پرریسک به یک مسیر قابل‌اطمینان تبدیل شود."
    ),
    "mission_title": "ماموریت ما",
    "mission": "ساده‌سازی خرید گجت با شفافیت قیمت، اصالت کالا و پشتیبانی قابل‌پیگیری تا لحظه تحویل.",
    "vision_title": "چشم‌انداز",
    "vision": "مرجع قابل‌اعتماد خرید گجت در ایران؛ جایی که انتخاب درست، سریع‌تر و کم‌ریسک‌تر باشد.",
    "stats": [
        {"value": "۵۰۰+", "label": "محصول منتخب"},
        {"value": "۲۴س", "label": "پاسخ پشتیبانی"},
        {"value": "سراسر کشور", "label": "ارسال امن"},
        {"value": "گارانتی", "label": "اصالت کالا"},
    ],
    "values": [
        {
            "title": "شفافیت کامل",
            "body": "قیمت، موجودی و شرایط ارسال را قبل از ثبت سفارش روشن می‌گوییم؛ بدون هزینه پنهان.",
        },
        {
            "title": "اصالت و کیفیت",
            "body": "روی برندها و مدل‌هایی تمرکز می‌کنیم که واقعاً ارزش خرید دارند و قابل پشتیبانی‌اند.",
        },
        {
            "title": "پشتیبانی انسانی",
            "body": "قبل و بعد از خرید کنار شماییم؛ از مشاوره انتخاب تا پیگیری سفارش و تیکت پشتیبانی.",
        },
        {
            "title": "ارسال با دقت",
            "body": "بسته‌بندی مخصوص گجت و هماهنگی ارسال تا محصول سالم به دستتان برسد.",
        },
    ],
    "highlights": [
        "مشاوره تخصصی قبل از خرید برای انتخاب مدل مناسب بودجه شما",
        "درگاه پرداخت امن و امکان کارت‌به‌کارت با تأیید ادمین",
        "پیگیری سفارش در حساب کاربری از ثبت تا تحویل",
        "به‌روزرسانی منظم موجودی و قیمت‌ها در فروشگاه",
        "پشتیبانی از طریق تیکت، تماس و صفحه ارتباط با ما",
        "تمرکز روی تجربه موبایل و دسکتاپ برای خرید راحت",
    ],
    "team_title": "چرا به ما اعتماد کنید؟",
    "team_body": (
        "ما فروشگاه‌محور نیستیم که فقط لینک پرداخت بگذاریم. مسیر خرید، وضعیت سفارش و پاسخ به "
        "سوال‌های فنی را طوری طراحی کرده‌ایم که حس کنید یک تیم واقعی پشت فروشگاه ایستاده است. "
        "اگر محصولی مناسب نیازتان نباشد، صادقانه می‌گوییم؛ اگر مناسب باشد، کمک می‌کنیم سریع‌تر تصمیم بگیرید."
    ),
    "cta_label": "مشاهده محصولات",
    "cta_href": "/products",
    "secondary_cta_label": "تماس با پشتیبانی",
    "secondary_cta_href": "/contact",
}

DEFAULT_CONTACT = {
    "eyebrow": "پشتیبانی",
    "title": "تماس با دیجی‌گج",
    "subtitle": "سوال، پیشنهاد یا پیگیری سفارش؛ از فرم یا کانال‌های زیر با ما در ارتباط باشید.",
    "intro": (
        "فرم زیر مستقیماً تیکت پشتیبانی می‌سازد تا هیچ پیام‌تان گم نشود. معمولاً در ساعات کاری "
        "در کوتاه‌ترین زمان پاسخ می‌دهیم. برای پیگیری سفارش، شماره سفارش یا کد پیگیری را در پیام بنویسید."
    ),
    "form_title": "ارسال پیام به پشتیبانی",
    "form_hint": "پس از ثبت، یک شماره تیکت دریافت می‌کنید و می‌توانید پاسخ را از حساب کاربری پیگیری کنید.",
    "hours_title": "ساعات پاسخ‌گویی",
    "hours": [
        {"days": "شنبه تا چهارشنبه", "time": "۹:۰۰ تا ۱۸:۰۰"},
        {"days": "پنجشنبه", "time": "۹:۰۰ تا ۱۴:۰۰"},
        {"days": "جمعه و تعطیلات رسمی", "time": "فقط پیگیری اضطراری سفارش"},
    ],
    "channels": [
        {
            "title": "تیکت پشتیبانی",
            "body": "بهترین مسیر برای ثبت درخواست، پیگیری سفارش و نگهداری تاریخچه گفتگو.",
        },
        {
            "title": "مشاوره قبل از خرید",
            "body": "اگر بین دو مدل مردد هستید، مشخصات و بودجه را بنویسید تا راهنمایی کنیم.",
        },
        {
            "title": "پیگیری ارسال",
            "body": "کد پیگیری و وضعیت سفارش در حساب کاربری و از طریق پشتیبانی قابل استعلام است.",
        },
    ],
    "faqs": [
        {
            "q": "چقدر طول می‌کشد پاسخ بگیرم؟",
            "a": "در ساعات کاری معمولاً در همان روز پاسخ می‌دهیم. پیام‌های خارج از ساعت کاری ابتدای روز بعد بررسی می‌شوند.",
        },
        {
            "q": "چطور وضعیت سفارشم را ببینم؟",
            "a": "وارد حساب کاربری شوید و از بخش «سفارش‌ها» جزئیات و وضعیت را دنبال کنید. اگر دسترسی ندارید، با شماره سفارش تیکت باز کنید.",
        },
        {
            "q": "آیا مشاوره انتخاب محصول دارید؟",
            "a": "بله. در فرم تماس موضوع را «مشاوره خرید» بگذارید و نیاز، بودجه و کاربرد را بنویسید.",
        },
        {
            "q": "پرداخت کارت‌به‌کارت چطور تأیید می‌شود؟",
            "a": "پس از واریز، رسید را طبق دستورالعمل درگاه ثبت کنید تا ادمین بررسی و سفارش را تأیید کند.",
        },
        {
            "q": "ارسال به شهرستان دارید؟",
            "a": "بله، ارسال به سراسر کشور انجام می‌شود. زمان دقیق بسته به مقصد و روش ارسال در مرحله تسویه مشخص می‌شود.",
        },
    ],
    "map_note": "آدرس دقیق فروشگاه/انبار در تنظیمات فروشگاه قابل به‌روزرسانی است و در همین صفحه نمایش داده می‌شود.",
    "promise_title": "قول ما در پشتیبانی",
    "promise_body": "هر تیکت یک مسئول پیگیری دارد؛ پاسخ مبهم نمی‌دهیم و تا روشن شدن وضعیت سفارش یا درخواست، موضوع را باز نگه می‌داریم.",
}


def _clip(value, max_len: int) -> str:
    return str(value or "").strip()[:max_len]


def _normalize_pairs(raw, *, left: str, right: str, max_items: int, left_len: int, right_len: int):
    out = []
    if not isinstance(raw, list):
        return out
    for item in raw[:max_items]:
        if not isinstance(item, dict):
            continue
        a = _clip(item.get(left), left_len)
        b = _clip(item.get(right), right_len)
        if a or b:
            out.append({left: a, right: b})
    return out


def _normalize_about(raw: dict | None) -> dict:
    data = deepcopy(DEFAULT_ABOUT)
    if not isinstance(raw, dict):
        return data
    for key in (
        "eyebrow",
        "title",
        "subtitle",
        "story",
        "mission_title",
        "mission",
        "vision_title",
        "vision",
        "team_title",
        "team_body",
        "cta_label",
        "cta_href",
        "secondary_cta_label",
        "secondary_cta_href",
    ):
        if key in raw and raw[key] is not None:
            limits = {
                "eyebrow": 80,
                "title": 160,
                "subtitle": 400,
                "story": 8000,
                "mission_title": 80,
                "mission": 800,
                "vision_title": 80,
                "vision": 800,
                "team_title": 120,
                "team_body": 2000,
                "cta_label": 60,
                "cta_href": 200,
                "secondary_cta_label": 60,
                "secondary_cta_href": 200,
            }
            data[key] = _clip(raw[key], limits[key])
    data["stats"] = _normalize_pairs(
        raw.get("stats"), left="value", right="label", max_items=8, left_len=40, right_len=80
    ) or data["stats"]
    data["values"] = _normalize_pairs(
        raw.get("values"), left="title", right="body", max_items=8, left_len=80, right_len=400
    ) or data["values"]
    highlights = []
    if isinstance(raw.get("highlights"), list):
        for item in raw["highlights"][:12]:
            text = _clip(item, 200)
            if text:
                highlights.append(text)
    if highlights:
        data["highlights"] = highlights
    return data


def _normalize_contact(raw: dict | None) -> dict:
    data = deepcopy(DEFAULT_CONTACT)
    if not isinstance(raw, dict):
        return data
    for key in (
        "eyebrow",
        "title",
        "subtitle",
        "intro",
        "form_title",
        "form_hint",
        "hours_title",
        "map_note",
        "promise_title",
        "promise_body",
    ):
        if key in raw and raw[key] is not None:
            limits = {
                "eyebrow": 80,
                "title": 160,
                "subtitle": 400,
                "intro": 2000,
                "form_title": 120,
                "form_hint": 400,
                "hours_title": 80,
                "map_note": 400,
                "promise_title": 120,
                "promise_body": 800,
            }
            data[key] = _clip(raw[key], limits[key])
    data["hours"] = _normalize_pairs(
        raw.get("hours"), left="days", right="time", max_items=8, left_len=80, right_len=80
    ) or data["hours"]
    data["channels"] = _normalize_pairs(
        raw.get("channels"), left="title", right="body", max_items=8, left_len=80, right_len=400
    ) or data["channels"]
    data["faqs"] = _normalize_pairs(
        raw.get("faqs"), left="q", right="a", max_items=12, left_len=200, right_len=800
    ) or data["faqs"]
    return data


def get_about_content() -> dict:
    row = SiteSetting.objects.filter(key=ABOUT_KEY).first()
    return _normalize_about(row.value if row else None)


def get_contact_content() -> dict:
    row = SiteSetting.objects.filter(key=CONTACT_KEY).first()
    return _normalize_contact(row.value if row else None)


def public_info_page(slug: str) -> dict:
    key = str(slug or "").strip().lower()
    if key == "about":
        return {"slug": "about", "content": get_about_content()}
    if key == "contact":
        return {"slug": "contact", "content": get_contact_content()}
    raise ValidationError({"slug": "صفحه نامعتبر است."})


def _sync_site_page(slug: str, title: str, body: str) -> None:
    SitePage.objects.update_or_create(
        slug=slug,
        defaults={
            "title": title[:200] or slug,
            "body": body[:20000] or title,
            "is_published": True,
        },
    )


@transaction.atomic
def save_about_content(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")
    content = _normalize_about(payload)
    if not content["title"]:
        raise ValidationError({"title": "عنوان الزامی است."})
    SiteSetting.objects.update_or_create(key=ABOUT_KEY, defaults={"value": content})
    _sync_site_page(
        "about",
        content["title"],
        "\n\n".join(
            part
            for part in (content["subtitle"], content["story"], content["mission"], content["vision"])
            if part
        ),
    )
    return content


@transaction.atomic
def save_contact_content(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")
    content = _normalize_contact(payload)
    if not content["title"]:
        raise ValidationError({"title": "عنوان الزامی است."})
    SiteSetting.objects.update_or_create(key=CONTACT_KEY, defaults={"value": content})
    _sync_site_page("contact", content["title"], content["intro"] or content["subtitle"])
    return content


def ensure_info_pages_defaults() -> None:
    from app.services.public_pages import PUBLIC_PAGES_KEY, get_public_pages_settings

    if not SiteSetting.objects.filter(key=ABOUT_KEY).exists():
        SiteSetting.objects.create(key=ABOUT_KEY, value=deepcopy(DEFAULT_ABOUT))
        _sync_site_page("about", DEFAULT_ABOUT["title"], DEFAULT_ABOUT["story"])
    if not SiteSetting.objects.filter(key=CONTACT_KEY).exists():
        SiteSetting.objects.create(key=CONTACT_KEY, value=deepcopy(DEFAULT_CONTACT))
        _sync_site_page("contact", DEFAULT_CONTACT["title"], DEFAULT_CONTACT["intro"])

    # One-time repair: older installs hid /about|/contact via public_pages.enabled
    # (or omitted the keys) while the admin UI showed a CMS duplicate without a clear
    # enable control. Re-enable once; admins can disable again afterward.
    if not SiteSetting.objects.filter(key=INFO_PAGES_ENABLE_REPAIR_KEY).exists():
        settings = get_public_pages_settings()
        enabled = dict(settings.get("enabled") or {})
        enabled["about"] = True
        enabled["contact"] = True
        settings["enabled"] = enabled
        SiteSetting.objects.update_or_create(key=PUBLIC_PAGES_KEY, defaults={"value": settings})
        SiteSetting.objects.create(key=INFO_PAGES_ENABLE_REPAIR_KEY, value={"done": True})

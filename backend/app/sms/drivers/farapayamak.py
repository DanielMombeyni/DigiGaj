from __future__ import annotations

from app.sms.http_client import post_form, post_json
from app.sms.base import BaseSmsDriver


class FarapayamakDriver(BaseSmsDriver):
    """فراپیامک — REST: https://docs.farapayamak.ir/webservice-rest"""

    provider_type = "farapayamak"
    label = "فراپیامک"
    docs_url = "https://docs.farapayamak.ir/webservice-rest?lang=fa"
    site_url = "https://farapayamak.ir"
    credential_schema = [
        {
            "key": "username",
            "label": "نام کاربری پنل",
            "required": True,
        },
        {
            "key": "password",
            "label": "کلید API / رمز وب‌سرویس",
            "required": True,
            "secret": True,
            "hint": "همان password وب‌سرویس در مستندات فراپیامک",
        },
        {
            "key": "from_number",
            "label": "شماره خط ارسال",
            "required": True,
            "hint": "شماره اختصاصی پنل (from)",
        },
        {
            "key": "message_template",
            "label": "متن پیامک",
            "required": False,
            "type": "textarea",
            "hint": "از {code} برای جای کد استفاده کنید",
        },
        {
            "key": "body_id",
            "label": "شناسه الگوی خدماتی (اختیاری)",
            "required": False,
            "hint": "در صورت پر بودن، از BaseServiceNumber به‌جای ارسال متن آزاد استفاده می‌شود",
        },
    ]

    BASE = "https://rest.payamak-panel.com/api/SendSMS"

    @classmethod
    def validate_credentials(cls, creds: dict) -> tuple[bool, str | None]:
        if not (creds.get("username") or "").strip():
            return False, "نام کاربری الزامی است"
        if not (creds.get("password") or "").strip():
            return False, "کلید API الزامی است"
        if not (creds.get("from_number") or "").strip():
            return False, "شماره خط ارسال الزامی است"
        return True, None

    @classmethod
    def send_otp(cls, *, phone: str, code: str, creds: dict) -> tuple[bool, str | None]:
        ok, err = cls.validate_credentials(creds)
        if not ok:
            return False, err

        username = str(creds["username"]).strip()
        password = str(creds["password"]).strip()
        from_number = str(creds["from_number"]).strip()
        body_id = str(creds.get("body_id") or "").strip()

        if body_id:
            # الگوی خدماتی: text = مقادیر متغیرها (کد)
            data, http_err = post_form(
                f"{cls.BASE}/BaseServiceNumber",
                {
                    "username": username,
                    "password": password,
                    "text": code,
                    "to": phone,
                    "bodyId": body_id,
                },
            )
        else:
            template = (creds.get("message_template") or "کد تأیید شما: {code}").strip()
            text = template.replace("{code}", code)
            data, http_err = post_json(
                f"{cls.BASE}/SendSMS",
                {
                    "username": username,
                    "password": password,
                    "to": phone,
                    "from": from_number,
                    "text": text,
                    "isflash": False,
                },
            )

        if http_err and data is None:
            return False, http_err

        ret = None
        if isinstance(data, dict):
            ret = data.get("RetStatus")
            if ret is None and "Value" in data:
                # بعضی پاسخ‌ها فقط Value دارند؛ مقدار منفی = خطا
                try:
                    val = int(str(data.get("Value")))
                    if val > 0:
                        return True, None
                    return False, data.get("StrRetStatus") or f"خطای فراپیامک ({val})"
                except (TypeError, ValueError):
                    pass
            if ret == 1 or str(ret) == "1":
                return True, None
            msg = data.get("StrRetStatus") or data.get("Value") or http_err
            return False, str(msg) if msg else "ارسال پیامک ناموفق بود"

        return False, http_err or "پاسخ نامعتبر از فراپیامک"

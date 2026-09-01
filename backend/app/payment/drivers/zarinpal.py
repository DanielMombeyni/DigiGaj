from __future__ import annotations

import logging
import requests

from app.payment.base import BasePaymentDriver
from app.payment.utils import toman_to_rial

logger = logging.getLogger("app.payment")


class ZarinpalDriver(BasePaymentDriver):
    provider_type = "zarinpal"
    label = "زرین‌پال"
    docs_url = "https://docs.zarinpal.com/"
    site_url = "https://zarinpal.com/"
    flow = "redirect"
    credential_schema = [
        {
            "key": "merchant_id",
            "label": "Merchant ID",
            "type": "text",
            "secret": True,
            "required": True,
            "hint": "کد پذیرنده زرین‌پال",
        },
        {
            "key": "sandbox",
            "label": "حالت تست (Sandbox)",
            "type": "boolean",
            "secret": False,
            "required": False,
        },
    ]

    @classmethod
    def validate_credentials(cls, creds):
        mid = (creds or {}).get("merchant_id")
        if not mid:
            return False, "merchant_id الزامی است"
        return True, None

    @classmethod
    def _base(cls, creds):
        if (creds or {}).get("sandbox"):
            return "https://sandbox.zarinpal.com/pg/v4/payment"
        return "https://api.zarinpal.com/pg/v4/payment"

    @classmethod
    def _start_pay_url(cls, creds, authority):
        if (creds or {}).get("sandbox"):
            return f"https://sandbox.zarinpal.com/pg/StartPay/{authority}"
        return f"https://www.zarinpal.com/pg/StartPay/{authority}"

    @classmethod
    def start(
        cls,
        *,
        amount_toman,
        callback_url,
        order_id,
        description,
        mobile="",
        creds,
        meta=None,
    ):
        payload = {
            "merchant_id": creds["merchant_id"],
            "amount": toman_to_rial(amount_toman),
            "callback_url": callback_url,
            "description": description or f"Order {order_id}",
            "metadata": {"order_id": str(order_id)},
        }
        if mobile:
            payload["metadata"]["mobile"] = mobile
        try:
            resp = requests.post(
                f"{cls._base(creds)}/request.json",
                json=payload,
                timeout=30,
            )
            data = resp.json()
        except Exception as exc:
            logger.exception("zarinpal start error")
            return None, f"خطای ارتباط زرین‌پال: {exc}"

        errors = data.get("errors")
        result = data.get("data") or {}
        if resp.status_code != 200 or (errors and errors not in ([], {})):
            msg = errors if errors else data
            return None, f"زرین‌پال: {msg}"
        authority = result.get("authority")
        if not authority:
            return None, "authority از زرین‌پال دریافت نشد"
        return (
            {
                "authority": authority,
                "payment_url": cls._start_pay_url(creds, authority),
                "raw": data,
            },
            None,
        )

    @classmethod
    def verify(cls, *, authority, amount_toman, creds, callback_data=None):
        status = (callback_data or {}).get("Status") or (callback_data or {}).get("status")
        if status and str(status).upper() not in ("OK", "100", "101"):
            return None, "پرداخت توسط کاربر لغو شد یا ناموفق بود"
        payload = {
            "merchant_id": creds["merchant_id"],
            "amount": toman_to_rial(amount_toman),
            "authority": authority,
        }
        try:
            resp = requests.post(
                f"{cls._base(creds)}/verify.json",
                json=payload,
                timeout=30,
            )
            data = resp.json()
        except Exception as exc:
            logger.exception("zarinpal verify error")
            return None, f"خطای تأیید زرین‌پال: {exc}"

        result = data.get("data") or {}
        code = result.get("code")
        if code in (100, 101):
            return (
                {
                    "ok": True,
                    "ref_id": str(result.get("ref_id", "")),
                    "raw": data,
                    "already_verified": code == 101,
                },
                None,
            )
        return None, f"تأیید ناموفق زرین‌پال (code={code})"

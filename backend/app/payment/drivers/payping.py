from __future__ import annotations

import logging
import requests

from app.payment.base import BasePaymentDriver
from app.payment.utils import toman_to_rial

logger = logging.getLogger("app.payment")


class PaypingDriver(BasePaymentDriver):
    provider_type = "payping"
    label = "پی‌پینگ"
    docs_url = "https://docs.payping.ir/"
    site_url = "https://www.payping.ir/"
    flow = "redirect"
    credential_schema = [
        {
            "key": "api_token",
            "label": "API Token",
            "type": "text",
            "secret": True,
            "required": True,
        },
        {
            "key": "currency",
            "label": "واحد پول",
            "type": "select",
            "secret": False,
            "required": True,
            "options": [
                {"value": "T", "label": "تومان"},
                {"value": "R", "label": "ریال"},
            ],
            "hint": "T = تومان، R = ریال",
        },
    ]

    API = "https://api.payping.ir/v3"

    @classmethod
    def validate_credentials(cls, creds):
        if not (creds or {}).get("api_token"):
            return False, "api_token الزامی است"
        currency = (creds or {}).get("currency", "T")
        if currency not in ("T", "R"):
            return False, "currency باید T یا R باشد"
        return True, None

    @classmethod
    def _headers(cls, creds):
        return {
            "Authorization": f"Bearer {creds['api_token']}",
            "Content-Type": "application/json",
        }

    @classmethod
    def _amount(cls, amount_toman, creds):
        currency = (creds or {}).get("currency", "T")
        if currency == "R":
            return toman_to_rial(amount_toman)
        return int(amount_toman)

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
            "amount": cls._amount(amount_toman, creds),
            "returnUrl": callback_url,
            "description": description or f"Order {order_id}",
            "clientRefId": str(order_id),
        }
        if mobile:
            payload["payerIdentity"] = mobile
        try:
            resp = requests.post(
                f"{cls.API}/pay",
                json=payload,
                headers=cls._headers(creds),
                timeout=30,
            )
            data = resp.json() if resp.content else {}
        except Exception as exc:
            logger.exception("payping start error")
            return None, f"خطای ارتباط پی‌پینگ: {exc}"

        if resp.status_code not in (200, 201):
            return None, f"پی‌پینگ: {data}"
        code = data.get("paymentCode") or data.get("code")
        url = data.get("url") or data.get("paymentUrl")
        if not code:
            return None, "کد پرداخت پی‌پینگ دریافت نشد"
        if not url:
            url = f"https://api.payping.ir/v3/pay/gotoipg/{code}"
        return (
            {"authority": str(code), "payment_url": url, "raw": data},
            None,
        )

    @classmethod
    def verify(cls, *, authority, amount_toman, creds, callback_data=None):
        ref_id = (
            (callback_data or {}).get("refid")
            or (callback_data or {}).get("refId")
            or (callback_data or {}).get("paymentRefId")
            or authority
        )
        payload = {
            "paymentRefId": ref_id,
            "paymentCode": authority,
            "amount": cls._amount(amount_toman, creds),
        }
        try:
            resp = requests.post(
                f"{cls.API}/pay/verify",
                json=payload,
                headers=cls._headers(creds),
                timeout=30,
            )
            data = resp.json() if resp.content else {}
        except Exception as exc:
            logger.exception("payping verify error")
            return None, f"خطای تأیید پی‌پینگ: {exc}"

        if resp.status_code not in (200, 201):
            return None, f"تأیید ناموفق پی‌پینگ: {data}"
        return (
            {
                "ok": True,
                "ref_id": str(data.get("paymentRefId") or ref_id),
                "raw": data,
            },
            None,
        )

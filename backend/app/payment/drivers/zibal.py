from __future__ import annotations

import logging
import requests

from app.payment.base import BasePaymentDriver
from app.payment.utils import toman_to_rial

logger = logging.getLogger("app.payment")


class ZibalDriver(BasePaymentDriver):
    provider_type = "zibal"
    label = "زیبال"
    docs_url = "https://help.zibal.ir/"
    site_url = "https://zibal.ir/"
    flow = "redirect"
    credential_schema = [
        {
            "key": "merchant",
            "label": "Merchant",
            "type": "text",
            "secret": True,
            "required": True,
            "hint": "برای تست: zibal",
        },
    ]

    API = "https://gateway.zibal.ir"

    @classmethod
    def validate_credentials(cls, creds):
        if not (creds or {}).get("merchant"):
            return False, "merchant الزامی است"
        return True, None

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
            "merchant": creds["merchant"],
            "amount": toman_to_rial(amount_toman),
            "callbackUrl": callback_url,
            "description": description or f"Order {order_id}",
            "orderId": str(order_id),
        }
        if mobile:
            payload["mobile"] = mobile
        try:
            resp = requests.post(f"{cls.API}/request", json=payload, timeout=30)
            data = resp.json()
        except Exception as exc:
            logger.exception("zibal start error")
            return None, f"خطای ارتباط زیبال: {exc}"

        if data.get("result") != 100:
            return None, f"زیبال: {data.get('message', data)}"
        track_id = data.get("trackId")
        if not track_id:
            return None, "trackId از زیبال دریافت نشد"
        return (
            {
                "authority": str(track_id),
                "payment_url": f"{cls.API}/start/{track_id}",
                "raw": data,
            },
            None,
        )

    @classmethod
    def verify(cls, *, authority, amount_toman, creds, callback_data=None):
        payload = {"merchant": creds["merchant"], "trackId": int(authority)}
        try:
            resp = requests.post(f"{cls.API}/verify", json=payload, timeout=30)
            data = resp.json()
        except Exception as exc:
            logger.exception("zibal verify error")
            return None, f"خطای تأیید زیبال: {exc}"

        result = data.get("result")
        if result not in (100, 201):
            return None, f"تأیید ناموفق زیبال (result={result})"
        paid = data.get("amount")
        expected = toman_to_rial(amount_toman)
        if paid is not None and int(paid) != expected:
            return None, "مبلغ پرداخت‌شده با سفارش مطابقت ندارد"
        return (
            {
                "ok": True,
                "ref_id": str(data.get("refNumber") or authority),
                "raw": data,
                "already_verified": result == 201,
            },
            None,
        )

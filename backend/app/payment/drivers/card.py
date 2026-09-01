from __future__ import annotations

import uuid

from app.payment.base import BasePaymentDriver


class CardDriver(BasePaymentDriver):
    """Card-to-card: show bank info to client; admin confirms manually."""

    provider_type = "card"
    label = "کارت‌به‌کارت"
    docs_url = ""
    site_url = ""
    flow = "card"
    credential_schema = [
        {
            "key": "card_number",
            "label": "شماره کارت",
            "type": "text",
            "secret": False,
            "required": True,
        },
        {
            "key": "card_holder",
            "label": "نام صاحب کارت",
            "type": "text",
            "secret": False,
            "required": True,
        },
        {
            "key": "bank_name",
            "label": "نام بانک",
            "type": "text",
            "secret": False,
            "required": False,
        },
        {
            "key": "instructions",
            "label": "راهنمای پرداخت",
            "type": "textarea",
            "secret": False,
            "required": False,
        },
    ]

    @classmethod
    def validate_credentials(cls, creds):
        if not (creds or {}).get("card_number"):
            return False, "شماره کارت الزامی است"
        if not (creds or {}).get("card_holder"):
            return False, "نام صاحب کارت الزامی است"
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
        authority = f"CARD-{uuid.uuid4().hex[:12].upper()}"
        extra = {
            "card_number": creds.get("card_number"),
            "card_holder": creds.get("card_holder"),
            "bank_name": creds.get("bank_name", ""),
            "instructions": creds.get(
                "instructions",
                "مبلغ را کارت‌به‌کارت کنید و رسید را برای پشتیبانی ارسال کنید.",
            ),
            "amount_toman": amount_toman,
            "requires_admin_confirm": True,
        }
        return (
            {
                "authority": authority,
                "payment_url": "",
                "extra": extra,
                "raw": {},
            },
            None,
        )

    @classmethod
    def verify(cls, *, authority, amount_toman, creds, callback_data=None):
        # Card stays pending until admin confirms — never auto-success here
        return None, "پرداخت کارت‌به‌کارت نیازمند تأیید ادمین است"

    @classmethod
    def public_extra(cls, creds):
        return {
            "card_number": (creds or {}).get("card_number", ""),
            "card_holder": (creds or {}).get("card_holder", ""),
            "bank_name": (creds or {}).get("bank_name", ""),
        }

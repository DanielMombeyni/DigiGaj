from __future__ import annotations

import copy
import logging

from django.db import transaction

from app.models import SmsProviderConfig
from app.payment.utils import is_masked_value, mask_secret
from app.sms.registry import get_driver, list_catalog

logger = logging.getLogger("app.sms")


class SmsProviderService:
    @staticmethod
    def catalog() -> dict:
        existing = {
            c.provider_type: c for c in SmsProviderConfig.objects.all()
        }
        items = []
        for entry in list_catalog():
            cfg = existing.get(entry["provider_type"])
            items.append(
                {
                    **entry,
                    "already_added": cfg is not None,
                    "config_id": cfg.id if cfg else None,
                    "is_enabled": cfg.is_enabled if cfg else False,
                }
            )
        return {"drivers": items}

    @classmethod
    def list_rows(cls) -> list[dict]:
        return [
            cls.serialize(cfg)
            for cfg in SmsProviderConfig.objects.all().order_by("sort_order", "id")
        ]

    @staticmethod
    def mask_credentials(creds: dict, schema: list[dict]) -> dict:
        out = copy.deepcopy(creds or {})
        secret_keys = {f["key"] for f in schema if f.get("secret")}
        for key in secret_keys:
            if key in out and out[key]:
                out[key] = mask_secret(str(out[key]))
        return out

    @classmethod
    def serialize(cls, cfg: SmsProviderConfig) -> dict:
        driver = get_driver(cfg.provider_type)
        schema = driver.credential_schema if driver else []
        return {
            "id": cfg.id,
            "provider_type": cfg.provider_type,
            "display_name": cfg.display_name,
            "label": driver.label if driver else cfg.display_name,
            "is_enabled": cfg.is_enabled,
            "sort_order": cfg.sort_order,
            "credentials": cls.mask_credentials(cfg.credentials or {}, schema),
            "credential_schema": schema,
            "docs_url": driver.docs_url if driver else "",
            "site_url": driver.site_url if driver else "",
            "is_ready": bool(driver and driver.is_ready(cfg.credentials or {})),
        }

    @classmethod
    def merge_credentials(
        cls, existing: dict, incoming: dict, schema: list[dict]
    ) -> dict:
        merged = copy.deepcopy(existing or {})
        for key, value in (incoming or {}).items():
            if is_masked_value(value):
                continue
            merged[key] = value
        return merged

    @classmethod
    @transaction.atomic
    def create(cls, data: dict) -> tuple[SmsProviderConfig | None, str | None]:
        provider = data.get("provider_type")
        driver = get_driver(provider)
        if not driver:
            return None, "نوع سرویس نامعتبر است"
        if SmsProviderConfig.objects.filter(provider_type=provider).exists():
            return None, "این سرویس قبلاً اضافه شده است"

        creds = data.get("credentials") or {}
        enable = bool(data.get("is_enabled"))
        if enable:
            ok, err = driver.validate_credentials(creds)
            if not ok:
                return None, err or "اطلاعات سرویس ناقص است"
            SmsProviderConfig.objects.update(is_enabled=False)

        count = SmsProviderConfig.objects.count()
        cfg = SmsProviderConfig(
            provider_type=provider,
            display_name=(data.get("display_name") or driver.label).strip(),
            is_enabled=enable,
            sort_order=count,
            credentials=creds,
        )
        cfg.save()
        return cfg, None

    @classmethod
    @transaction.atomic
    def update(cls, cfg: SmsProviderConfig, data: dict) -> tuple[SmsProviderConfig | None, str | None]:
        driver = get_driver(cfg.provider_type)
        if not driver:
            return None, "سرویس نامعتبر است"

        if "display_name" in data and data["display_name"] is not None:
            cfg.display_name = str(data["display_name"]).strip() or cfg.display_name

        if "credentials" in data and data["credentials"] is not None:
            cfg.credentials = cls.merge_credentials(
                cfg.credentials or {},
                data["credentials"] or {},
                driver.credential_schema,
            )

        enable = data.get("is_enabled")
        if enable is not None:
            enable = bool(enable)
            if enable:
                ok, err = driver.validate_credentials(cfg.credentials or {})
                if not ok:
                    return None, err or "اطلاعات سرویس ناقص است"
                SmsProviderConfig.objects.exclude(pk=cfg.pk).update(is_enabled=False)
            cfg.is_enabled = enable

        cfg.save()
        return cfg, None

    @staticmethod
    def delete(cfg: SmsProviderConfig) -> None:
        cfg.delete()

    @classmethod
    def get_active(cls) -> SmsProviderConfig | None:
        return (
            SmsProviderConfig.objects.filter(is_enabled=True)
            .order_by("sort_order", "id")
            .first()
        )

    @classmethod
    def send_otp(cls, phone: str, code: str) -> tuple[bool, str | None]:
        cfg = cls.get_active()
        if not cfg:
            return False, "هیچ سرویس پیامکی فعالی تنظیم نشده است."
        driver = get_driver(cfg.provider_type)
        if not driver:
            return False, "درایور پیامک یافت نشد."
        if not driver.is_ready(cfg.credentials or {}):
            return False, "تنظیمات سرویس پیامک ناقص است."
        try:
            return driver.send_otp(phone=phone, code=code, creds=cfg.credentials or {})
        except Exception:
            logger.exception("SMS send failed via %s", cfg.provider_type)
            return False, "خطا در ارسال پیامک"

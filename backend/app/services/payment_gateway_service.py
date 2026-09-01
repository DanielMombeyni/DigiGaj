from __future__ import annotations

import copy
import logging

from django.db import transaction

from app.models import PaymentGatewayConfig
from app.payment.registry import get_driver, list_catalog
from app.payment.utils import is_masked_value, mask_secret, public_api_base

logger = logging.getLogger("app.payment")


def _logo_url(cfg: PaymentGatewayConfig, request=None) -> str:
    if not cfg.logo:
        return ""
    try:
        path = cfg.logo.url
    except Exception:
        return ""
    if path.startswith("http"):
        return path
    return f"{public_api_base()}{path}"


class PaymentGatewayService:
    @staticmethod
    def catalog() -> dict:
        existing = {
            c.provider_type: c for c in PaymentGatewayConfig.objects.all()
        }
        items = []
        for entry in list_catalog():
            cfg = existing.get(entry["provider_type"])
            items.append(
                {
                    **entry,
                    "already_added": cfg is not None,
                    "config_id": cfg.id if cfg else None,
                    "is_enabled_app": cfg.is_enabled_app if cfg else False,
                    "is_enabled_web": cfg.is_enabled_web if cfg else False,
                }
            )
        return {"drivers": items}

    @staticmethod
    def mask_credentials(creds: dict, schema: list[dict]) -> dict:
        out = copy.deepcopy(creds or {})
        secret_keys = {f["key"] for f in schema if f.get("secret")}
        for key in secret_keys:
            if key in out and out[key]:
                out[key] = mask_secret(str(out[key]))
        return out

    @classmethod
    def serialize_config(cls, cfg: PaymentGatewayConfig, request=None) -> dict:
        driver = get_driver(cfg.provider_type)
        schema = driver.credential_schema if driver else []
        return {
            "id": cfg.id,
            "provider_type": cfg.provider_type,
            "display_name": cfg.display_name,
            "is_enabled_app": cfg.is_enabled_app,
            "is_enabled_web": cfg.is_enabled_web,
            "sort_order": cfg.sort_order,
            "logo": _logo_url(cfg, request),
            "logo_url": _logo_url(cfg, request),
            "credentials": cls.mask_credentials(cfg.credentials or {}, schema),
            "flow": driver.flow if driver else "",
            "label": driver.label if driver else cfg.display_name,
            "credential_schema": schema,
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
    def create(cls, data: dict) -> tuple[PaymentGatewayConfig | None, str | None]:
        provider = data.get("provider_type")
        driver = get_driver(provider)
        if not driver:
            return None, "نوع درگاه نامعتبر است"
        if PaymentGatewayConfig.objects.filter(provider_type=provider).exists():
            return None, "این درگاه قبلاً اضافه شده است"
        creds = data.get("credentials") or {}
        enable_app = bool(data.get("is_enabled_app"))
        enable_web = bool(data.get("is_enabled_web"))
        if enable_app or enable_web:
            ok, err = driver.validate_credentials(creds)
            if not ok:
                return None, err or "قبل از فعال‌سازی، تنظیمات باید کامل باشد"
        cfg = PaymentGatewayConfig(
            provider_type=provider,
            display_name=data.get("display_name") or driver.label,
            is_enabled_app=enable_app,
            is_enabled_web=enable_web,
            sort_order=int(data.get("sort_order") or 0),
            credentials=creds,
        )
        if data.get("logo"):
            cfg.logo = data["logo"]
        cfg.save()
        return cfg, None

    @classmethod
    @transaction.atomic
    def update(
        cls, cfg: PaymentGatewayConfig, data: dict
    ) -> tuple[PaymentGatewayConfig | None, str | None]:
        driver = get_driver(cfg.provider_type)
        if not driver:
            return None, "درایور درگاه یافت نشد"
        if "display_name" in data and data["display_name"]:
            cfg.display_name = data["display_name"]
        if "sort_order" in data and data["sort_order"] is not None:
            cfg.sort_order = int(data["sort_order"])
        if "credentials" in data and data["credentials"] is not None:
            cfg.credentials = cls.merge_credentials(
                cfg.credentials or {},
                data["credentials"],
                driver.credential_schema,
            )
        enable_app = data.get("is_enabled_app", cfg.is_enabled_app)
        enable_web = data.get("is_enabled_web", cfg.is_enabled_web)
        if enable_app or enable_web:
            if not driver.is_ready(cfg.credentials or {}):
                return None, "قبل از فعال‌سازی، credentials باید کامل باشد"
        cfg.is_enabled_app = bool(enable_app)
        cfg.is_enabled_web = bool(enable_web)
        if "logo" in data:
            cfg.logo = data["logo"]
        cfg.save()
        return cfg, None

    @staticmethod
    def delete(cfg: PaymentGatewayConfig) -> None:
        cfg.delete()

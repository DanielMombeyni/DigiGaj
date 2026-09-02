from __future__ import annotations

import logging

from app.models import PaymentGatewayConfig
from .registry import get_driver
from .utils import absolute_media_url, detect_platform

logger = logging.getLogger("app.payment")


class PaymentFacade:
    @staticmethod
    def get_config(provider: str, platform: str) -> PaymentGatewayConfig | None:
        try:
            cfg = PaymentGatewayConfig.objects.get(provider_type=provider)
        except PaymentGatewayConfig.DoesNotExist:
            return None
        if platform == "app" and not cfg.is_enabled_app:
            return None
        if platform == "web" and not cfg.is_enabled_web:
            return None
        return cfg

    @classmethod
    def list_enabled_public(cls, request, platform: str | None = None) -> list[dict]:
        platform = platform or detect_platform(request)
        qs = PaymentGatewayConfig.objects.all().order_by("sort_order", "provider_type")
        results = []
        for cfg in qs:
            if platform == "app" and not cfg.is_enabled_app:
                continue
            if platform == "web" and not cfg.is_enabled_web:
                continue
            driver = get_driver(cfg.provider_type)
            if not driver or not driver.is_ready(cfg.credentials or {}):
                continue
            if driver.flow == "native" and platform == "web":
                continue
            logo_url = ""
            if cfg.logo:
                logo_url = absolute_media_url(cfg.logo.url, request) or ""
            results.append(
                {
                    "provider_type": cfg.provider_type,
                    "display_name": cfg.display_name,
                    "flow": driver.flow,
                    "logo": logo_url,
                    "logo_url": logo_url,
                    "currency": "IRR",
                    "extra": driver.public_extra(cfg.credentials or {}),
                }
            )
        return results

    @classmethod
    def start_payment(
        cls,
        *,
        provider: str,
        amount_toman: int,
        callback_url: str,
        order_id: str,
        description: str,
        platform: str,
        mobile: str = "",
        meta: dict | None = None,
    ) -> tuple[dict | None, str | None]:
        cfg = cls.get_config(provider, platform)
        if not cfg:
            return None, "درگاه برای این پلتفرم فعال نیست"
        driver = get_driver(provider)
        if not driver:
            return None, "درایور درگاه یافت نشد"
        if driver.flow == "native" and platform != "app":
            return None, "این درگاه فقط برای اپلیکیشن است"
        if not driver.is_ready(cfg.credentials or {}):
            return None, "تنظیمات درگاه ناقص است"
        try:
            return driver.start(
                amount_toman=amount_toman,
                callback_url=callback_url,
                order_id=order_id,
                description=description,
                mobile=mobile,
                creds=cfg.credentials or {},
                meta=meta,
            )
        except Exception:
            logger.exception("payment start failed provider=%s", provider)
            return None, "خطا در اتصال به درگاه پرداخت"

    @classmethod
    def verify_payment(
        cls,
        *,
        provider: str,
        authority: str,
        amount_toman: int,
        platform: str,
        callback_data: dict | None = None,
    ) -> tuple[dict | None, str | None]:
        cfg = cls.get_config(provider, platform)
        if not cfg:
            # For callback, config may still exist but disabled — fall back to raw row
            try:
                cfg = PaymentGatewayConfig.objects.get(provider_type=provider)
            except PaymentGatewayConfig.DoesNotExist:
                return None, "درگاه یافت نشد"
        driver = get_driver(provider)
        if not driver:
            return None, "درایور درگاه یافت نشد"
        try:
            return driver.verify(
                authority=authority,
                amount_toman=amount_toman,
                creds=cfg.credentials or {},
                callback_data=callback_data,
            )
        except Exception:
            logger.exception("payment verify failed provider=%s", provider)
            return None, "خطا در تأیید پرداخت"

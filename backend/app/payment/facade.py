from __future__ import annotations

import logging

from app.models import PaymentGatewayConfig
from .registry import get_driver
from .utils import absolute_media_url, detect_platform

logger = logging.getLogger("app.payment")


def _credentials_dict(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    return {}


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
            try:
                if platform == "app" and not cfg.is_enabled_app:
                    continue
                if platform == "web" and not cfg.is_enabled_web:
                    continue
                driver = get_driver(cfg.provider_type)
                creds = _credentials_dict(cfg.credentials)
                if not driver or not driver.is_ready(creds):
                    logger.info(
                        "gateway skipped provider=%s platform=%s ready=%s",
                        cfg.provider_type,
                        platform,
                        bool(driver and driver.is_ready(creds)) if driver else False,
                    )
                    continue
                if driver.flow == "native" and platform == "web":
                    continue
                logo_url = ""
                if cfg.logo:
                    try:
                        logo_url = absolute_media_url(cfg.logo.url, request) or ""
                    except Exception:
                        logo_url = ""
                results.append(
                    {
                        "provider_type": cfg.provider_type,
                        "display_name": cfg.display_name,
                        "flow": driver.flow,
                        "logo": logo_url,
                        "logo_url": logo_url,
                        "currency": "IRR",
                        "extra": driver.public_extra(creds),
                    }
                )
            except Exception:
                logger.exception(
                    "gateway list failed provider=%s", getattr(cfg, "provider_type", "?")
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
        creds = _credentials_dict(cfg.credentials)
        if not driver.is_ready(creds):
            return None, "تنظیمات درگاه ناقص است"
        try:
            return driver.start(
                amount_toman=amount_toman,
                callback_url=callback_url,
                order_id=order_id,
                description=description,
                mobile=mobile,
                creds=creds,
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
                creds=_credentials_dict(cfg.credentials),
                callback_data=callback_data,
            )
        except Exception:
            logger.exception("payment verify failed provider=%s", provider)
            return None, "خطا در تأیید پرداخت"

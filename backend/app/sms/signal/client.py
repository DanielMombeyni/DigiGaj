"""
Signal SMS (Transmitor) HTTP client.

Docs: https://transmitor.signalads.com/document
Base: https://transmitor.signalads.com
Auth: Authorization: Bearer <API-KEY>
"""

from __future__ import annotations

import logging
from typing import Any, Sequence

import requests
from django.conf import settings

from app.sms.signal.exceptions import (
    SignalSmsAuthError,
    SignalSmsConfigError,
    SignalSmsError,
    SignalSmsInsufficientBalanceError,
    SignalSmsNotFoundError,
    SignalSmsRateLimitError,
)

logger = logging.getLogger("app.sms.signal")

# Heuristic phrases from Signal / common Iranian SMS gateways (Persian + English).
_AUTH_HINTS = (
    "unauthorized",
    "unauthenticated",
    "authentication",
    "invalid token",
    "invalid api",
    "expired",
    "منقضی",
    "احراز هویت",
    "نامعتبر",
    "توکن",
    "کلید",
)
_BALANCE_HINTS = (
    "insufficient",
    "balance",
    "credit",
    "موجودی",
    "اعتبار",
    "ناکافی",
    "کمبود",
)


def _message_from_payload(payload: Any) -> str:
    if payload is None:
        return ""
    if isinstance(payload, str):
        return payload.strip()
    if isinstance(payload, dict):
        for key in ("message", "detail", "error", "msg", "description"):
            val = payload.get(key)
            if isinstance(val, dict):
                nested = _message_from_payload(val)
                if nested:
                    return nested
            if val not in (None, ""):
                return str(val).strip()
        errors = payload.get("errors")
        if isinstance(errors, (list, tuple)) and errors:
            return str(errors[0])
        if isinstance(errors, dict) and errors:
            first = next(iter(errors.values()))
            if isinstance(first, (list, tuple)) and first:
                return str(first[0])
            return str(first)
    return str(payload).strip()


def _raise_for_signal_error(status_code: int, payload: Any) -> None:
    raw = _message_from_payload(payload)
    lowered = raw.lower()

    if status_code in (401, 403) or any(h in lowered for h in _AUTH_HINTS):
        logger.error("Signal SMS auth failure (%s): %s", status_code, raw[:300])
        raise SignalSmsAuthError(raw or None, details=payload)

    if status_code == 402 or any(h in lowered for h in _BALANCE_HINTS):
        logger.error("Signal SMS insufficient balance (%s): %s", status_code, raw[:300])
        raise SignalSmsInsufficientBalanceError(raw or None, details=payload)

    if status_code == 404:
        logger.warning("Signal SMS not found (%s): %s", status_code, raw[:300])
        raise SignalSmsNotFoundError(raw or None, details=payload)

    if status_code == 429:
        logger.warning("Signal SMS rate limited: %s", raw[:300])
        raise SignalSmsRateLimitError(raw or None, details=payload)

    logger.error("Signal SMS API error (%s): %s", status_code, raw[:500])
    raise SignalSmsError(
        raw or f"خطای سرویس پیامک سیگنال (کد {status_code})",
        details=payload,
    )


class SignalSmsService:
    """
    Dedicated client for Signal Transmitor REST API.

    Uses a shared requests.Session with Bearer auth and JSON content-type
    so callers do not repeat headers/base URL.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        sender: str | None = None,
        base_url: str | None = None,
        timeout: int | None = None,
    ):
        self.api_key = (api_key if api_key is not None else getattr(settings, "SIGNAL_SMS_API_KEY", "")).strip()
        self.sender = (sender if sender is not None else getattr(settings, "SIGNAL_SMS_FROM", "")).strip()
        self.base_url = (
            base_url
            if base_url is not None
            else getattr(settings, "SIGNAL_SMS_BASE_URL", "https://transmitor.signalads.com")
        ).rstrip("/")
        self.timeout = timeout if timeout is not None else int(getattr(settings, "SIGNAL_SMS_TIMEOUT", 20))

        if not self.api_key:
            raise SignalSmsConfigError(
                "کلید API سیگنال تنظیم نشده است. SIGNAL_SMS_API_KEY را در .env قرار دهید "
                "(توجه: اعتبار کلید ۳۶۵ روز است و ساخت کلید جدید، کلید قبلی را منقضی می‌کند)."
            )

        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def _url(self, path: str) -> str:
        if not path.startswith("/"):
            path = f"/{path}"
        return f"{self.base_url}{path}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
        params: dict | None = None,
    ) -> Any:
        url = self._url(path)
        try:
            response = self._session.request(
                method=method.upper(),
                url=url,
                json=json_body,
                params=params,
                timeout=self.timeout,
            )
        except requests.Timeout as exc:
            logger.exception("Signal SMS timeout: %s %s", method, path)
            raise SignalSmsError("زمان پاسخ سرویس پیامک سیگنال به پایان رسید.") from exc
        except requests.RequestException as exc:
            logger.exception("Signal SMS transport error: %s %s", method, path)
            raise SignalSmsError("ارتباط با سرویس پیامک سیگنال برقرار نشد.") from exc

        payload: Any
        if not response.content:
            payload = {}
        else:
            try:
                payload = response.json()
            except ValueError:
                payload = {"raw": response.text[:500]}

        if response.status_code >= 400:
            _raise_for_signal_error(response.status_code, payload)

        # Some gateways return 200 with an error flag in the body.
        if isinstance(payload, dict):
            success = payload.get("success")
            if success is False or str(payload.get("status", "")).lower() in ("error", "failed"):
                _raise_for_signal_error(response.status_code or 502, payload)

        return payload

    def _resolve_sender(self, sender: str | None) -> str:
        value = (sender or self.sender or "").strip()
        if not value:
            raise SignalSmsConfigError(
                "شماره خط ارسال سیگنال تنظیم نشده است. SIGNAL_SMS_FROM یا پارامتر from_number را پر کنید."
            )
        return value

    @staticmethod
    def _normalize_numbers(numbers: str | Sequence[str]) -> list[str]:
        if isinstance(numbers, str):
            items = [numbers]
        else:
            items = list(numbers)
        out: list[str] = []
        for raw in items:
            n = str(raw or "").strip()
            if n:
                out.append(n)
        if not out:
            raise SignalSmsError("حداقل یک شماره موبایل برای ارسال پیامک لازم است.")
        return out

    def send_sms(
        self,
        phone: str,
        message: str,
        *,
        sender: str | None = None,
        send_at: str | None = None,
    ) -> dict:
        """Send a single SMS. POST /api_v1/sms/send"""
        text = (message or "").strip()
        if not text:
            raise SignalSmsError("متن پیامک نمی‌تواند خالی باشد.")
        payload: dict[str, Any] = {
            "from": self._resolve_sender(sender),
            "message": text,
            "numbers": self._normalize_numbers(phone),
        }
        if send_at:
            payload["send_at"] = send_at
        return self._request("POST", "/api_v1/sms/send", json_body=payload)

    def send_bulk(
        self,
        phones: Sequence[str],
        message: str | Sequence[str],
        *,
        sender: str | None = None,
        send_at: str | None = None,
    ) -> dict | list[dict]:
        """
        Bulk SMS.

        - Shared message: one POST with all numbers in `numbers`.
        - Per-recipient messages: parallel list of texts (same length as phones);
          sends one request per recipient and returns a list of responses.
        """
        numbers = self._normalize_numbers(phones)

        if isinstance(message, str):
            text = message.strip()
            if not text:
                raise SignalSmsError("متن پیامک نمی‌تواند خالی باشد.")
            payload: dict[str, Any] = {
                "from": self._resolve_sender(sender),
                "message": text,
                "numbers": numbers,
            }
            if send_at:
                payload["send_at"] = send_at
            return self._request("POST", "/api_v1/sms/send", json_body=payload)

        texts = [str(m or "").strip() for m in message]
        if len(texts) != len(numbers):
            raise SignalSmsError("تعداد متن‌های پیامک باید با تعداد گیرنده‌ها برابر باشد.")
        if any(not t for t in texts):
            raise SignalSmsError("هیچ متن پیامکی نمی‌تواند خالی باشد.")

        results: list[dict] = []
        for number, text in zip(numbers, texts):
            results.append(
                self.send_sms(number, text, sender=sender, send_at=send_at)
            )
        return results

    def delivery_report(self, message_id: str | int, *, page: int = 1) -> dict:
        """GET /api_v1/sms/status/{msg_id}?page={page}"""
        mid = str(message_id or "").strip()
        if not mid:
            raise SignalSmsError("شناسه پیامک برای گزارش دلیوری الزامی است.")
        page_num = max(1, int(page or 1))
        return self._request(
            "GET",
            f"/api_v1/sms/status/{mid}",
            params={"page": page_num},
        )

    def check_balance(self) -> dict:
        """GET /api_v1/user/credit — account credit / balance."""
        return self._request("GET", "/api_v1/user/credit")

    def send_pattern(
        self,
        phone: str,
        pattern_id: int | str,
        parameters: dict[str, Any] | None = None,
        *,
        sender: str | None = None,
    ) -> dict:
        """POST /api_v1/sms/pattern/send — useful for OTP templates."""
        payload = {
            "from": self._resolve_sender(sender),
            "pattern_id": int(str(pattern_id).strip()),
            "number": self._normalize_numbers(phone)[0],
            "parameters": parameters or {},
        }
        return self._request("POST", "/api_v1/sms/pattern/send", json_body=payload)

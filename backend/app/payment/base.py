from abc import ABC, abstractmethod
from typing import Any


class BasePaymentDriver(ABC):
    provider_type: str = ""
    label: str = ""
    docs_url: str = ""
    site_url: str = ""
    flow: str = "redirect"  # redirect | card | native
    credential_schema: list[dict] = []

    @classmethod
    @abstractmethod
    def validate_credentials(cls, creds: dict) -> tuple[bool, str | None]:
        raise NotImplementedError

    @classmethod
    def is_ready(cls, creds: dict) -> bool:
        ok, _ = cls.validate_credentials(creds or {})
        return ok

    @classmethod
    @abstractmethod
    def start(
        cls,
        *,
        amount_toman: int,
        callback_url: str,
        order_id: str,
        description: str,
        mobile: str = "",
        creds: dict,
        meta: dict | None = None,
    ) -> tuple[dict | None, str | None]:
        """Return ({authority, payment_url, extra?, raw?}, None) or (None, error)."""
        raise NotImplementedError

    @classmethod
    @abstractmethod
    def verify(
        cls,
        *,
        authority: str,
        amount_toman: int,
        creds: dict,
        callback_data: dict | None = None,
    ) -> tuple[dict | None, str | None]:
        """Return ({ok: True, ref_id, raw}, None) or (None, error)."""
        raise NotImplementedError

    @classmethod
    def public_extra(cls, creds: dict) -> dict[str, Any]:
        return {}

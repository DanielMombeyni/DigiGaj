from abc import ABC, abstractmethod


class BaseSmsDriver(ABC):
    provider_type: str = ""
    label: str = ""
    docs_url: str = ""
    site_url: str = ""
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
    def send_otp(cls, *, phone: str, code: str, creds: dict) -> tuple[bool, str | None]:
        """Send OTP SMS. Return (True, None) or (False, error)."""
        raise NotImplementedError

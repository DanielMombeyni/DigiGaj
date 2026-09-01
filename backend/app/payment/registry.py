from __future__ import annotations

from .drivers import ALL_DRIVERS
from .base import BasePaymentDriver


_REGISTRY: dict[str, type[BasePaymentDriver]] = {
    d.provider_type: d for d in ALL_DRIVERS
}


def get_driver(provider_type: str) -> type[BasePaymentDriver] | None:
    return _REGISTRY.get(provider_type)


def list_catalog() -> list[dict]:
    items = []
    for driver in ALL_DRIVERS:
        items.append(
            {
                "provider_type": driver.provider_type,
                "label": driver.label,
                "docs_url": driver.docs_url,
                "site_url": driver.site_url,
                "flow": driver.flow,
                "credential_schema": driver.credential_schema,
            }
        )
    return items

from __future__ import annotations

from .drivers import ALL_DRIVERS
from .base import BaseSmsDriver

_REGISTRY: dict[str, type[BaseSmsDriver]] = {d.provider_type: d for d in ALL_DRIVERS}


def get_driver(provider_type: str) -> type[BaseSmsDriver] | None:
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
                "credential_schema": driver.credential_schema,
            }
        )
    return items

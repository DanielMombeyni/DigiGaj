"""Track one-time deploy seeds (bootstrap / demo catalog)."""

from __future__ import annotations

from app.models import SiteSetting

SEED_STATE_KEY = "deploy_seed_state"
BOOTSTRAP_MARKER = "bootstrap_v1"
DEMO_MARKER = "demo_v1"


def get_seed_state() -> dict:
    row = SiteSetting.objects.filter(key=SEED_STATE_KEY).first()
    if row and isinstance(row.value, dict):
        return dict(row.value)
    return {}


def is_seed_done(marker: str) -> bool:
    return bool(get_seed_state().get(marker))


def mark_seed_done(marker: str) -> None:
    state = get_seed_state()
    state[marker] = True
    SiteSetting.objects.update_or_create(key=SEED_STATE_KEY, defaults={"value": state})

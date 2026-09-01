"""Django settings package — split by environment via django-split-settings."""
from split_settings.tools import include, optional
import os

ENV = os.environ.get("DJANGO_ENV", "local")

include(
    "components/base.py",
    "components/database.py",
    "components/auth.py",
    "components/rest.py",
    "components/celery.py",
    "components/channels.py",
    "components/payment.py",
    f"environments/{ENV}.py",
    optional("local_settings.py"),
)

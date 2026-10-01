import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def locmem_cache(settings):
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "auth-tests",
        }
    }
    cache.clear()


@pytest.fixture
def api():
    from rest_framework.test import APIClient

    return APIClient()

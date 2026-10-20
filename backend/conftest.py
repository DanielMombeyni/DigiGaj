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


@pytest.hookimpl(trylast=True)
def pytest_sessionstart(session):
    """Install connection-boundary guard after Django is configured."""
    from app.tests.sms_db_isolation import (
        SmsTestDbIsolationError,
        install_sms_db_connection_boundary,
    )

    try:
        install_sms_db_connection_boundary(session.config)
    except SmsTestDbIsolationError as exc:
        pytest.exit(f"SMS test DB isolation guard: {exc}", returncode=2)


@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session, exitstatus):
    from app.tests.sms_db_isolation import uninstall_sms_db_connection_boundary

    uninstall_sms_db_connection_boundary(session.config)


@pytest.hookimpl(trylast=True)
def pytest_collection_modifyitems(config, items):
    """
    Fail closed before any DB-backed test session proceeds without isolation.

    Database-free collections are left alone so unit tests do not require
    the sms-test Postgres container.
    """
    from app.tests.sms_db_isolation import (
        SmsTestDbIsolationError,
        collection_needs_database,
        isolation_enforcement_enabled,
        require_isolated_sms_test_database,
    )

    try:
        if not isolation_enforcement_enabled():
            return
        if not collection_needs_database(items):
            return
        require_isolated_sms_test_database()
    except SmsTestDbIsolationError as exc:
        # Safe message only (module never includes passwords).
        pytest.exit(f"SMS test DB isolation guard: {exc}", returncode=2)


@pytest.fixture(scope="session")
def django_db_modify_db_settings(
    django_db_modify_db_settings_parallel_suffix: None,  # noqa: ARG001
) -> None:
    """
    Preserve pytest-django's parallel/tox suffix chain, then validate isolation
    immediately before setup_databases().
    """
    from app.tests.sms_db_isolation import (
        isolation_enforcement_enabled,
        require_isolated_sms_test_database,
    )

    if isolation_enforcement_enabled():
        require_isolated_sms_test_database()

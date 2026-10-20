"""
Lifecycle tests for SMS DB isolation (no real PostgreSQL).

Uses pytest's built-in pytester to exercise collection fail-closed behavior
in an isolated subprocess with a deliberately unsafe Django DATABASES target.
"""

from __future__ import annotations

import os
import textwrap
from pathlib import Path

import pytest

from app.tests.sms_db_isolation import (
    ISOLATION_SENTINEL_KEY,
    ISOLATION_SENTINEL_VALUE,
)

pytest_plugins = ["pytester"]

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _child_conftest() -> str:
    return textwrap.dedent(
        """
        import django
        import pytest

        django.setup()

        @pytest.hookimpl(trylast=True)
        def pytest_sessionstart(session):
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
                pytest.exit(f"SMS test DB isolation guard: {exc}", returncode=2)
        """
    )


def _unsafe_settings() -> str:
    return textwrap.dedent(
        """
        SECRET_KEY = "guard-lifecycle-not-a-secret"
        USE_TZ = True
        INSTALLED_APPS = []
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": ":memory:",
                "USER": "gadget",
                "HOST": "localhost",
                "PORT": "5432",
                "PASSWORD": "lifecycle-password-must-not-leak",
            }
        }
        """
    )


def _prepare(pytester, monkeypatch, *, sentinel: bool = False, extra_env: dict | None = None):
    monkeypatch.delenv("DIGIGAJ_ALLOW_NON_SMS_TEST_DB", raising=False)
    for key in (
        ISOLATION_SENTINEL_KEY,
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
        "POSTGRES_PASSWORD",
    ):
        monkeypatch.delenv(key, raising=False)
    if sentinel:
        monkeypatch.setenv(ISOLATION_SENTINEL_KEY, ISOLATION_SENTINEL_VALUE)
    if extra_env:
        for key, value in extra_env.items():
            monkeypatch.setenv(key, value)

    pytester.syspathinsert(_BACKEND_ROOT)
    existing = os.environ.get("PYTHONPATH", "")
    monkeypatch.setenv(
        "PYTHONPATH",
        str(_BACKEND_ROOT)
        + (os.pathsep + existing if existing else ""),
    )
    # Must override the parent session's config.settings (cross-drive split_settings
    # breaks when pytester cwd is on another mount).
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "guard_child_settings")
    monkeypatch.setenv("DJANGO_ENV", "local")
    pytester.makeini(
        """
        [pytest]
        DJANGO_SETTINGS_MODULE = guard_child_settings
        markers =
            django_db: isolation lifecycle marker (no pytest-django required)
        """
    )
    pytester.makepyfile(guard_child_settings=_unsafe_settings())
    pytester.makeconftest(_child_conftest())


def test_pytester_db_marker_exits_when_env_missing(pytester, monkeypatch):
    _prepare(pytester, monkeypatch, sentinel=True)
    pytester.makepyfile(
        """
        import pytest

        @pytest.mark.django_db
        def test_would_use_db():
            assert False, "must not execute"
        """
    )
    # Subprocess avoids the parent DigiGaj conftest / pytest-django DB setup path.
    result = pytester.runpytest_subprocess("-q")
    assert result.ret == 2
    text = result.stdout.str() + result.stderr.str()
    assert "SMS test DB isolation guard" in text
    assert "POSTGRES_" in text
    assert "lifecycle-password-must-not-leak" not in text


def test_pytester_db_marker_exits_on_unsafe_name_host_port_user(pytester, monkeypatch):
    _prepare(
        pytester,
        monkeypatch,
        sentinel=True,
        extra_env={
            "POSTGRES_DB": "gadgetstore",
            "POSTGRES_USER": "gadget",
            "POSTGRES_HOST": "db",
            "POSTGRES_PORT": "5432",
        },
    )
    pytester.makepyfile(
        """
        import pytest

        @pytest.mark.django_db
        def test_would_use_db():
            assert False, "must not execute"
        """
    )
    result = pytester.runpytest_subprocess("-q")
    assert result.ret == 2
    text = result.stdout.str() + result.stderr.str()
    assert "SMS test DB isolation guard" in text
    assert "lifecycle-password-must-not-leak" not in text


def test_pytester_unmarked_ensure_keeps_pytest_django_block(pytester, monkeypatch):
    """Installing the SMS guard must not remove pytest-django's DB block stub."""
    _prepare(pytester, monkeypatch, sentinel=False)
    pytester.makepyfile(
        """
        from unittest.mock import MagicMock
        import pytest
        from django.db.backends.base.base import BaseDatabaseWrapper

        def test_unmarked_ensure_still_blocked_by_pytest_django():
            with pytest.raises(RuntimeError, match="Database access not allowed"):
                BaseDatabaseWrapper.ensure_connection(MagicMock())
        """
    )
    result = pytester.runpytest_subprocess("-q")
    assert result.ret == 0
    text = result.stdout.str() + result.stderr.str()
    assert "lifecycle-password-must-not-leak" not in text


def test_pytester_database_free_passes_without_isolation_env(pytester, monkeypatch):
    _prepare(pytester, monkeypatch, sentinel=False)
    pytester.makepyfile(
        """
        def test_pure_unit():
            assert 1 + 1 == 2
        """
    )
    result = pytester.runpytest_subprocess("-q")
    assert result.ret == 0


def test_pytester_testcase_subclass_triggers_collection_guard(pytester, monkeypatch):
    _prepare(pytester, monkeypatch, sentinel=True)
    pytester.makepyfile(
        """
        from django.test import TestCase

        class SampleDBTest(TestCase):
            def test_should_not_run(self):
                assert False, "must not execute"
        """
    )
    result = pytester.runpytest_subprocess("-q")
    assert result.ret == 2
    text = result.stdout.str() + result.stderr.str()
    assert "SMS test DB isolation guard" in text
    assert "lifecycle-password-must-not-leak" not in text


def test_pytester_both_sentinel_and_opt_out_exit(pytester, monkeypatch):
    _prepare(pytester, monkeypatch, sentinel=True)
    monkeypatch.setenv("DIGIGAJ_ALLOW_NON_SMS_TEST_DB", "1")
    pytester.makepyfile(
        """
        def test_pure_unit():
            assert True
        """
    )
    result = pytester.runpytest_subprocess("-q")
    assert result.ret == 2
    text = result.stdout.str() + result.stderr.str()
    assert "SMS test DB isolation guard" in text
    assert "mutually exclusive" in text
    assert "lifecycle-password-must-not-leak" not in text


def test_pytester_django_db_blocker_unblock_cannot_connect(pytester, monkeypatch):
    """
    Real django_db_blocker.unblock() must not open a DB socket without isolation.

    After sessionstart installs the boundary, unblock() still routes through a
    guarded ensure_connection (blocker snapshots the wrapped method).
    """
    _prepare(pytester, monkeypatch, sentinel=False)
    pytester.makepyfile(
        """
        from unittest.mock import MagicMock
        import pytest
        from django.db.backends.base.base import BaseDatabaseWrapper
        from app.tests.sms_db_isolation import SmsTestDbIsolationError

        def test_unblock_still_blocked(django_db_blocker):
            wrapper = MagicMock()
            wrapper.settings_dict = {
                "NAME": "gadgetstore",
                "USER": "gadget",
                "HOST": "localhost",
                "PORT": "5432",
                "PASSWORD": "unblock-secret-must-not-leak",
            }
            with django_db_blocker.unblock():
                with pytest.raises(SmsTestDbIsolationError) as excinfo:
                    BaseDatabaseWrapper.ensure_connection(wrapper)
            assert "unblock-secret-must-not-leak" not in str(excinfo.value)
        """
    )
    result = pytester.runpytest_subprocess("-q")
    assert result.ret == 0
    text = result.stdout.str() + result.stderr.str()
    assert "unblock-secret-must-not-leak" not in text
    assert "lifecycle-password-must-not-leak" not in text

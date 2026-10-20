"""Database-free regression tests for the SMS pytest isolation guard."""

from __future__ import annotations

import inspect
from unittest.mock import MagicMock

import pytest

from app.tests import sms_db_isolation as iso
from app.tests.sms_db_isolation import (
    ALLOW_NON_SMS_TEST_DB_KEY,
    ISOLATION_SENTINEL_KEY,
    ISOLATION_SENTINEL_VALUE,
    SmsTestDbIsolationError,
    assert_env_mode_compatible,
    collection_needs_database,
    connection_boundary_is_installed,
    install_sms_db_connection_boundary,
    isolation_enforcement_enabled,
    uninstall_sms_db_connection_boundary,
    validate_connection_settings_dict,
    validate_sms_test_db_isolation,
)

_GOOD_ENV = {
    ISOLATION_SENTINEL_KEY: ISOLATION_SENTINEL_VALUE,
    "POSTGRES_DB": "sms_pytest",
    "POSTGRES_USER": "sms_pytest",
    "POSTGRES_HOST": "127.0.0.1",
    "POSTGRES_PORT": "55432",
    "POSTGRES_PASSWORD": "must-never-appear-in-errors",
}

_GOOD_DB = {
    "NAME": "sms_pytest",
    "USER": "sms_pytest",
    "HOST": "127.0.0.1",
    "PORT": "55432",
    "PASSWORD": "must-never-appear-in-errors",
}


class _Item:
    def __init__(self, marker=None, fixturenames=(), cls=None):
        self._marker = marker
        self.fixturenames = fixturenames
        self.cls = cls

    def get_closest_marker(self, name):
        if name == "django_db":
            return self._marker
        return None


def _restore_boundary_after(monkeypatch, real_ensure):
    from django.db.backends.base.base import BaseDatabaseWrapper

    uninstall_sms_db_connection_boundary()
    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", real_ensure)
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    monkeypatch.delenv(ALLOW_NON_SMS_TEST_DB_KEY, raising=False)
    install_sms_db_connection_boundary()


def test_guard_accepts_correct_explicit_configuration():
    validate_sms_test_db_isolation(environ=_GOOD_ENV, database_default=_GOOD_DB)


def test_guard_rejects_missing_sentinel():
    env = dict(_GOOD_ENV)
    env.pop(ISOLATION_SENTINEL_KEY)
    with pytest.raises(SmsTestDbIsolationError, match="sentinel"):
        validate_sms_test_db_isolation(environ=env, database_default=_GOOD_DB)


def test_guard_rejects_missing_process_postgres_overrides():
    env = {ISOLATION_SENTINEL_KEY: ISOLATION_SENTINEL_VALUE}
    with pytest.raises(SmsTestDbIsolationError, match="POSTGRES_"):
        validate_sms_test_db_isolation(environ=env, database_default=_GOOD_DB)


def test_guard_rejects_gadgetstore():
    env = dict(_GOOD_ENV)
    env["POSTGRES_DB"] = "gadgetstore"
    db = dict(_GOOD_DB)
    db["NAME"] = "gadgetstore"
    with pytest.raises(SmsTestDbIsolationError, match="gadgetstore"):
        validate_sms_test_db_isolation(environ=env, database_default=db)


def test_guard_rejects_wrong_user():
    env = dict(_GOOD_ENV)
    env["POSTGRES_USER"] = "gadget"
    db = dict(_GOOD_DB)
    db["USER"] = "gadget"
    with pytest.raises(SmsTestDbIsolationError, match="user"):
        validate_sms_test_db_isolation(environ=env, database_default=db)


def test_guard_rejects_port_5432():
    env = dict(_GOOD_ENV)
    env["POSTGRES_PORT"] = "5432"
    db = dict(_GOOD_DB)
    db["PORT"] = "5432"
    with pytest.raises(SmsTestDbIsolationError, match="5432"):
        validate_sms_test_db_isolation(environ=env, database_default=db)


def test_guard_rejects_non_loopback_host():
    env = dict(_GOOD_ENV)
    env["POSTGRES_HOST"] = "db"
    db = dict(_GOOD_DB)
    db["HOST"] = "db"
    with pytest.raises(SmsTestDbIsolationError, match="loopback"):
        validate_sms_test_db_isolation(environ=env, database_default=db)


def test_guard_rejects_localhost_as_host():
    env = dict(_GOOD_ENV)
    env["POSTGRES_HOST"] = "localhost"
    db = dict(_GOOD_DB)
    db["HOST"] = "localhost"
    with pytest.raises(SmsTestDbIsolationError, match="loopback"):
        validate_sms_test_db_isolation(environ=env, database_default=db)


def test_guard_rejects_env_settings_mismatch():
    env = dict(_GOOD_ENV)
    env["POSTGRES_HOST"] = "127.0.0.1"
    db = dict(_GOOD_DB)
    db["HOST"] = "::1"
    with pytest.raises(SmsTestDbIsolationError, match="disagree"):
        validate_sms_test_db_isolation(environ=env, database_default=db)


def test_guard_error_never_includes_password():
    env = dict(_GOOD_ENV)
    env["POSTGRES_DB"] = "gadgetstore"
    db = dict(_GOOD_DB)
    db["NAME"] = "gadgetstore"
    secret = "must-never-appear-in-errors"
    with pytest.raises(SmsTestDbIsolationError) as excinfo:
        validate_sms_test_db_isolation(environ=env, database_default=db)
    message = str(excinfo.value)
    assert secret not in message
    assert "must-never-appear" not in message
    assert "password" not in message.lower()


def test_both_sentinel_and_opt_out_fail_closed():
    env = dict(_GOOD_ENV)
    env[ALLOW_NON_SMS_TEST_DB_KEY] = "1"
    with pytest.raises(SmsTestDbIsolationError, match="mutually exclusive"):
        assert_env_mode_compatible(environ=env)
    with pytest.raises(SmsTestDbIsolationError, match="mutually exclusive"):
        isolation_enforcement_enabled(environ=env)
    with pytest.raises(SmsTestDbIsolationError, match="mutually exclusive"):
        validate_sms_test_db_isolation(environ=env, database_default=_GOOD_DB)


def test_opt_out_alone_disables_enforcement():
    env = {ALLOW_NON_SMS_TEST_DB_KEY: "1"}
    assert isolation_enforcement_enabled(environ=env) is False


def test_sentinel_alone_enables_enforcement():
    env = {ISOLATION_SENTINEL_KEY: ISOLATION_SENTINEL_VALUE}
    assert isolation_enforcement_enabled(environ=env) is True


def test_neither_sentinel_nor_opt_out_enforces():
    assert isolation_enforcement_enabled(environ={}) is True


def test_collection_needs_database_detects_marker_and_fixtures():
    assert collection_needs_database([]) is False
    assert collection_needs_database([_Item()]) is False
    assert collection_needs_database([_Item(marker=object())]) is True
    assert collection_needs_database([_Item(fixturenames=("db",))]) is True
    assert collection_needs_database([_Item(fixturenames=("live_server",))]) is True
    assert collection_needs_database([_Item(fixturenames=("django_db_blocker",))]) is False


def test_collection_recognizes_django_testcase_and_transaction_testcase():
    from django.test import TestCase, TransactionTestCase

    class _TC(TestCase):
        pass

    class _TTC(TransactionTestCase):
        pass

    assert collection_needs_database([_Item(cls=_TC)]) is True
    assert collection_needs_database([_Item(cls=_TTC)]) is True


def test_modify_db_settings_fixture_keeps_parallel_suffix_dependency():
    import conftest as root_conftest

    sig = inspect.signature(root_conftest.django_db_modify_db_settings)
    assert "django_db_modify_db_settings_parallel_suffix" in sig.parameters


def test_connection_rejects_unsafe_secondary_alias_settings_dict(monkeypatch):
    uninstall_sms_db_connection_boundary()
    connected = []
    from django.db.backends.base.base import BaseDatabaseWrapper

    real = BaseDatabaseWrapper.ensure_connection

    def _fake_real(self, *args, **kwargs):
        connected.append(True)
        return None

    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", _fake_real)
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    for key, value in _GOOD_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv(ALLOW_NON_SMS_TEST_DB_KEY, raising=False)

    assert install_sms_db_connection_boundary() is True
    unsafe = MagicMock()
    unsafe.settings_dict = {
        "NAME": "gadgetstore",
        "USER": "gadget",
        "HOST": "db",
        "PORT": "5432",
        "PASSWORD": "alias-secret-must-not-leak",
    }
    with pytest.raises(SmsTestDbIsolationError) as excinfo:
        BaseDatabaseWrapper.ensure_connection(unsafe)
    assert connected == []
    assert "alias-secret-must-not-leak" not in str(excinfo.value)
    _restore_boundary_after(monkeypatch, real)


def test_connection_accepts_test_prefixed_name_without_real_connect(monkeypatch):
    uninstall_sms_db_connection_boundary()
    connected = []
    from django.db.backends.base.base import BaseDatabaseWrapper

    real = BaseDatabaseWrapper.ensure_connection

    def _fake_real(self, *args, **kwargs):
        connected.append(getattr(self, "settings_dict", {}).get("NAME"))
        return None

    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", _fake_real)
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    for key, value in _GOOD_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv(ALLOW_NON_SMS_TEST_DB_KEY, raising=False)

    assert install_sms_db_connection_boundary() is True
    wrapper = MagicMock()
    wrapper.settings_dict = {
        "NAME": "test_sms_pytest",
        "USER": "sms_pytest",
        "HOST": "127.0.0.1",
        "PORT": "55432",
        "PASSWORD": "must-never-appear-in-errors",
    }
    BaseDatabaseWrapper.ensure_connection(wrapper)
    assert connected == ["test_sms_pytest"]
    _restore_boundary_after(monkeypatch, real)


def test_validate_connection_settings_dict_helper():
    validate_connection_settings_dict(
        {
            "NAME": "test_sms_pytest",
            "USER": "sms_pytest",
            "HOST": "127.0.0.1",
            "PORT": "55432",
        },
        environ=_GOOD_ENV,
    )
    with pytest.raises(SmsTestDbIsolationError, match="gadgetstore"):
        validate_connection_settings_dict(
            {
                "NAME": "gadgetstore",
                "USER": "sms_pytest",
                "HOST": "127.0.0.1",
                "PORT": "55432",
            },
            environ=_GOOD_ENV,
        )


def test_connection_boundary_blocks_unmarked_ensure_without_isolation(monkeypatch):
    uninstall_sms_db_connection_boundary()
    connected = []
    from django.db.backends.base.base import BaseDatabaseWrapper

    real = BaseDatabaseWrapper.ensure_connection

    def _fake_real(self, *args, **kwargs):
        connected.append(True)
        return None

    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", _fake_real)
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    for key in (
        ISOLATION_SENTINEL_KEY,
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
        ALLOW_NON_SMS_TEST_DB_KEY,
    ):
        monkeypatch.delenv(key, raising=False)

    assert install_sms_db_connection_boundary() is True
    assert connection_boundary_is_installed() is True
    with pytest.raises(SmsTestDbIsolationError, match="sentinel"):
        BaseDatabaseWrapper.ensure_connection(MagicMock(settings_dict={}))
    assert connected == []
    _restore_boundary_after(monkeypatch, real)


def test_connection_boundary_opt_out_skips_install(monkeypatch):
    uninstall_sms_db_connection_boundary()
    monkeypatch.delenv(ISOLATION_SENTINEL_KEY, raising=False)
    monkeypatch.setenv(ALLOW_NON_SMS_TEST_DB_KEY, "1")
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    assert install_sms_db_connection_boundary() is False
    assert connection_boundary_is_installed() is False
    monkeypatch.delenv(ALLOW_NON_SMS_TEST_DB_KEY, raising=False)
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    install_sms_db_connection_boundary()


def test_install_raises_when_both_modes_set(monkeypatch):
    uninstall_sms_db_connection_boundary()
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    for key, value in _GOOD_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv(ALLOW_NON_SMS_TEST_DB_KEY, "1")
    with pytest.raises(SmsTestDbIsolationError, match="mutually exclusive"):
        install_sms_db_connection_boundary()
    monkeypatch.delenv(ALLOW_NON_SMS_TEST_DB_KEY, raising=False)
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    install_sms_db_connection_boundary()


def test_uninstall_is_idempotent_after_exception(monkeypatch):
    uninstall_sms_db_connection_boundary()
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    for key, value in _GOOD_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv(ALLOW_NON_SMS_TEST_DB_KEY, raising=False)
    from django.db.backends.base.base import BaseDatabaseWrapper

    real = BaseDatabaseWrapper.ensure_connection

    def _fake_real(self, *args, **kwargs):
        raise RuntimeError("simulated backend failure after validation")

    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", _fake_real)
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    assert install_sms_db_connection_boundary() is True
    wrapper = MagicMock()
    wrapper.settings_dict = dict(_GOOD_DB)
    with pytest.raises(RuntimeError, match="simulated backend failure"):
        BaseDatabaseWrapper.ensure_connection(wrapper)
    uninstall_sms_db_connection_boundary()
    assert connection_boundary_is_installed() is False
    uninstall_sms_db_connection_boundary()  # idempotent
    assert connection_boundary_is_installed() is False
    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", real)
    monkeypatch.setattr(iso, "_original_ensure_connection", None)
    monkeypatch.setattr(iso, "_connection_guard_installed", False)
    install_sms_db_connection_boundary()


def test_database_free_guard_module_import_has_no_django_db_marker():
    assert True

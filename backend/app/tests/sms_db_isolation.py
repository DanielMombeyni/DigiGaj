"""
Fail-closed guard for DigiGaj SMS / Django database-backed pytest.

Layers:
  1) Collection: refuse DB-oriented collections without validated isolation.
  2) django_db_modify_db_settings: refuse before setup_databases().
  3) Connection boundary: wrap ensure_connection so unblock()/unmarked
     access cannot open a socket without validating this wrapper's
     settings_dict (and process POSTGRES_*).

Explicit SMS isolation requires DIGIGAJ_SMS_TEST_DB=1 plus matching POSTGRES_*.
Opt-out DIGIGAJ_ALLOW_NON_SMS_TEST_DB=1 disables enforcement only when the
SMS sentinel is NOT set. Both enabled together fail closed.

This module never prints passwords and never rewrites Django settings.
Runtime Compose/volume proof is out of scope — see docs/sms-test-isolation.md.
"""

from __future__ import annotations

import os
from typing import Any, Callable, Mapping

REQUIRED_DB_NAME = "sms_pytest"
REQUIRED_DB_USER = "sms_pytest"
REQUIRED_PORT = "55432"
ALLOWED_HOSTS = frozenset({"127.0.0.1", "::1"})
# pytest-django renames NAME to test_<POSTGRES_DB> when creating the test DB.
ALLOWED_CONNECTION_DB_NAMES = frozenset(
    {REQUIRED_DB_NAME, f"test_{REQUIRED_DB_NAME}"}
)

ISOLATION_SENTINEL_KEY = "DIGIGAJ_SMS_TEST_DB"
ISOLATION_SENTINEL_VALUE = "1"

ALLOW_NON_SMS_TEST_DB_KEY = "DIGIGAJ_ALLOW_NON_SMS_TEST_DB"
ALLOW_NON_SMS_TEST_DB_VALUE = "1"

REQUIRED_ENV_KEYS = (
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
)

FORBIDDEN_DB_NAMES = frozenset(
    {
        "gadgetstore",
        "postgres",
        "template0",
        "template1",
        "test_gadgetstore",
    }
)
FORBIDDEN_DB_USERS = frozenset({"gadget"})
FORBIDDEN_PORTS = frozenset({"5432"})

_DB_FIXTURE_NAMES = frozenset(
    {
        "db",
        "transactional_db",
        "django_db_setup",
        "live_server",
        # NOTE: do NOT include django_db_blocker — pytest-django injects it via
        # autouse unittest setup for many non-DB tests. Unblock+connect is
        # covered by the ensure_connection boundary instead.
    }
)

_connection_guard_installed = False
_original_ensure_connection: Callable[..., Any] | None = None
_guarded_ensure_connection: Callable[..., Any] | None = None


class SmsTestDbIsolationError(RuntimeError):
    """Raised when database-dependent tests must not proceed."""


def _norm(value: Any) -> str:
    return str(value if value is not None else "").strip()


def _safe_target(*, name: str, user: str, host: str, port: str) -> str:
    return f"name={name!s} user={user!s} host={host!s} port={port!s}"


def _reject(reason: str, *, name: str = "", user: str = "", host: str = "", port: str = "") -> None:
    detail = _safe_target(name=name, user=user, host=host, port=port)
    raise SmsTestDbIsolationError(f"{reason} ({detail})")


def sms_isolation_sentinel_enabled(*, environ: Mapping[str, str] | None = None) -> bool:
    env = os.environ if environ is None else environ
    return _norm(env.get(ISOLATION_SENTINEL_KEY)) == ISOLATION_SENTINEL_VALUE


def non_sms_test_db_allowed(*, environ: Mapping[str, str] | None = None) -> bool:
    env = os.environ if environ is None else environ
    return _norm(env.get(ALLOW_NON_SMS_TEST_DB_KEY)) == ALLOW_NON_SMS_TEST_DB_VALUE


def assert_env_mode_compatible(*, environ: Mapping[str, str] | None = None) -> None:
    """Fail closed when SMS sentinel and non-SMS opt-out are both enabled."""
    if sms_isolation_sentinel_enabled(environ=environ) and non_sms_test_db_allowed(
        environ=environ
    ):
        raise SmsTestDbIsolationError(
            f"{ISOLATION_SENTINEL_KEY}={ISOLATION_SENTINEL_VALUE} and "
            f"{ALLOW_NON_SMS_TEST_DB_KEY}={ALLOW_NON_SMS_TEST_DB_VALUE} cannot both "
            "be enabled. SMS isolation mode and the non-SMS opt-out are mutually "
            "exclusive."
        )


def isolation_enforcement_enabled(*, environ: Mapping[str, str] | None = None) -> bool:
    """
    Return True when SMS isolation gates must run.

    Raises if sentinel and opt-out are both set.
    Returns False only for an explicit opt-out without the SMS sentinel.
    """
    assert_env_mode_compatible(environ=environ)
    return not non_sms_test_db_allowed(environ=environ)


def _read_process_postgres(
    environ: Mapping[str, str],
) -> tuple[str, str, str, str]:
    if not sms_isolation_sentinel_enabled(environ=environ):
        raise SmsTestDbIsolationError(
            f"Missing explicit process isolation sentinel "
            f"{ISOLATION_SENTINEL_KEY}={ISOLATION_SENTINEL_VALUE}. "
            "Set it in the pytest process environment together with POSTGRES_* "
            "overrides. Application .env alone is not accepted as proof of isolation."
        )

    missing = [key for key in REQUIRED_ENV_KEYS if not _norm(environ.get(key))]
    if missing:
        raise SmsTestDbIsolationError(
            "Missing explicit process POSTGRES_* overrides for database-dependent "
            f"tests: {', '.join(missing)}. Do not rely on .env defaults."
        )

    env_name = _norm(environ.get("POSTGRES_DB"))
    env_user = _norm(environ.get("POSTGRES_USER"))
    env_host = _norm(environ.get("POSTGRES_HOST"))
    env_port = _norm(environ.get("POSTGRES_PORT"))

    _assert_target_identity(
        name=env_name,
        user=env_user,
        host=env_host,
        port=env_port,
        source="process environment",
        allow_test_db_prefix=False,
    )
    return env_name, env_user, env_host, env_port


def validate_sms_test_db_isolation(
    *,
    environ: Mapping[str, str] | None = None,
    database_default: Mapping[str, Any] | None = None,
) -> None:
    """
    Validate isolation for collection / setup gates.

    Checks process env against ``settings.DATABASES["default"]`` (or the
    provided mapping). Never mutates settings. Never includes passwords.
    """
    env: Mapping[str, str] = os.environ if environ is None else environ
    assert_env_mode_compatible(environ=env)
    env_name, env_user, env_host, env_port = _read_process_postgres(env)

    if database_default is None:
        from django.conf import settings

        database_default = settings.DATABASES["default"]

    validate_database_config(
        database_default,
        source="Django DATABASES['default']",
        environ=env,
        expected_process=(env_name, env_user, env_host, env_port),
        allow_test_db_prefix=False,
    )


def validate_database_config(
    config: Mapping[str, Any],
    *,
    source: str,
    environ: Mapping[str, str] | None = None,
    expected_process: tuple[str, str, str, str] | None = None,
    allow_test_db_prefix: bool = False,
) -> None:
    """Validate a Django DB settings mapping (alias config or settings_dict)."""
    env: Mapping[str, str] = os.environ if environ is None else environ
    assert_env_mode_compatible(environ=env)

    if expected_process is None:
        expected_process = _read_process_postgres(env)
    env_name, env_user, env_host, env_port = expected_process

    name = _norm(config.get("NAME"))
    user = _norm(config.get("USER"))
    host = _norm(config.get("HOST"))
    port = _norm(config.get("PORT"))

    _assert_target_identity(
        name=name,
        user=user,
        host=host,
        port=port,
        source=source,
        allow_test_db_prefix=allow_test_db_prefix,
    )

    if (user, host, port) != (env_user, env_host, env_port):
        _reject(
            f"{source} user/host/port disagree with process POSTGRES_* overrides",
            name=name,
            user=user,
            host=host,
            port=port,
        )

    if allow_test_db_prefix:
        if name not in {env_name, f"test_{env_name}"}:
            _reject(
                f"{source} database name must be {env_name!r} or "
                f"'test_{env_name}' (pytest-django test DB)",
                name=name,
                user=user,
                host=host,
                port=port,
            )
    elif name != env_name:
        _reject(
            f"{source} disagrees with process POSTGRES_DB",
            name=name,
            user=user,
            host=host,
            port=port,
        )


def validate_connection_settings_dict(
    settings_dict: Mapping[str, Any],
    *,
    environ: Mapping[str, str] | None = None,
) -> None:
    """Validate the specific wrapper connection about to be opened."""
    validate_database_config(
        settings_dict,
        source="connection settings_dict",
        environ=environ,
        allow_test_db_prefix=True,
    )


def _assert_target_identity(
    *,
    name: str,
    user: str,
    host: str,
    port: str,
    source: str,
    allow_test_db_prefix: bool,
) -> None:
    if name in FORBIDDEN_DB_NAMES or name == "gadgetstore":
        _reject(
            f"{source}: forbidden database name (refusing gadgetstore / non-test DB)",
            name=name,
            user=user,
            host=host,
            port=port,
        )
    if allow_test_db_prefix:
        if name not in ALLOWED_CONNECTION_DB_NAMES:
            _reject(
                f"{source}: database name must be one of "
                f"{sorted(ALLOWED_CONNECTION_DB_NAMES)!r}",
                name=name,
                user=user,
                host=host,
                port=port,
            )
    elif name != REQUIRED_DB_NAME:
        _reject(
            f"{source}: database name must be {REQUIRED_DB_NAME!r}",
            name=name,
            user=user,
            host=host,
            port=port,
        )
    if user in FORBIDDEN_DB_USERS:
        _reject(
            f"{source}: forbidden database user (application default is not allowed)",
            name=name,
            user=user,
            host=host,
            port=port,
        )
    if user != REQUIRED_DB_USER:
        _reject(
            f"{source}: database user must be {REQUIRED_DB_USER!r}",
            name=name,
            user=user,
            host=host,
            port=port,
        )
    if port in FORBIDDEN_PORTS or port == "5432":
        _reject(
            f"{source}: port 5432 is forbidden (application Postgres publish port)",
            name=name,
            user=user,
            host=host,
            port=port,
        )
    if port != REQUIRED_PORT:
        _reject(
            f"{source}: port must be {REQUIRED_PORT!r}",
            name=name,
            user=user,
            host=host,
            port=port,
        )
    if host not in ALLOWED_HOSTS:
        _reject(
            f"{source}: host must be loopback 127.0.0.1 or ::1 "
            f"(got non-loopback or unbound host {host!r})",
            name=name,
            user=user,
            host=host,
            port=port,
        )


def require_isolated_sms_test_database() -> None:
    """Validate using live ``os.environ`` and Django settings. No settings mutation."""
    validate_sms_test_db_isolation()


def _item_is_django_db_testcase(item: Any) -> bool:
    """
    Mirror pytest-django: any django.test.TransactionTestCase (incl. TestCase)
    is treated as database-using.
    """
    cls = getattr(item, "cls", None)
    if cls is None or not isinstance(cls, type):
        return False
    try:
        from django.test import TransactionTestCase
    except Exception:
        return False
    try:
        return issubclass(cls, TransactionTestCase)
    except TypeError:
        return False


def collection_needs_database(items: list) -> bool:
    """Return True if any collected item is database-dependent."""
    for item in items:
        if item.get_closest_marker("django_db") is not None:
            return True
        fixturenames = getattr(item, "fixturenames", ()) or ()
        if _DB_FIXTURE_NAMES.intersection(fixturenames):
            return True
        if _item_is_django_db_testcase(item):
            return True
    return False


def _pytest_django_blocker(config: Any | None):
    if config is None:
        return None
    try:
        from pytest_django.plugin import blocking_manager_key
    except Exception:
        return None
    try:
        return config.stash.get(blocking_manager_key, default=None)
    except Exception:
        return None


def install_sms_db_connection_boundary(config: Any | None = None) -> bool:
    """
    Wrap Django's underlying ensure_connection so connections require isolation
    validation against this wrapper's ``settings_dict``.

    Integrates with pytest-django's DjangoDbBlocker: the blocker's saved
    ``_real_ensure_connection`` is updated to the guarded method so
    ``unblock()`` cannot restore a pre-guard implementation.

    Returns True if installed (or already installed).
    Returns False if opt-out is set without the SMS sentinel.
    Raises if sentinel and opt-out are both set.
    """
    global _connection_guard_installed, _original_ensure_connection, _guarded_ensure_connection

    if not isolation_enforcement_enabled():
        return False

    from django.db.backends.base.base import BaseDatabaseWrapper

    if _connection_guard_installed:
        # Refresh blocker pointer in case config was unavailable on first install.
        blocker = _pytest_django_blocker(config)
        if blocker is not None and _guarded_ensure_connection is not None:
            blocker._real_ensure_connection = _guarded_ensure_connection
        return True

    blocker = _pytest_django_blocker(config)
    underlying = None
    if blocker is not None and getattr(blocker, "_real_ensure_connection", None) is not None:
        underlying = blocker._real_ensure_connection
    if underlying is None:
        underlying = BaseDatabaseWrapper.ensure_connection

    _original_ensure_connection = underlying
    real = underlying

    def _guarded(self: Any, *args: Any, **kwargs: Any) -> Any:
        # Fail closed before any backend socket/handshake work.
        assert_env_mode_compatible()
        settings_dict = getattr(self, "settings_dict", None) or {}
        validate_connection_settings_dict(settings_dict)
        return real(self, *args, **kwargs)

    _guarded_ensure_connection = _guarded

    if blocker is not None:
        # unblock() restores _real_ensure_connection — keep it guarded.
        blocker._real_ensure_connection = _guarded
        # If DB access is currently unblocked, switch the active method too.
        # If blocked, leave the blocking stub in place; unblock will restore _guarded.
        if BaseDatabaseWrapper.ensure_connection is underlying:
            BaseDatabaseWrapper.ensure_connection = _guarded  # type: ignore[method-assign]
    else:
        BaseDatabaseWrapper.ensure_connection = _guarded  # type: ignore[method-assign]

    _connection_guard_installed = True
    return True


def uninstall_sms_db_connection_boundary(config: Any | None = None) -> None:
    """Restore the previous ensure_connection implementation if we wrapped it."""
    global _connection_guard_installed, _original_ensure_connection, _guarded_ensure_connection

    if not _connection_guard_installed or _original_ensure_connection is None:
        _connection_guard_installed = False
        _guarded_ensure_connection = None
        return

    from django.db.backends.base.base import BaseDatabaseWrapper

    blocker = _pytest_django_blocker(config)
    if blocker is not None:
        blocker._real_ensure_connection = _original_ensure_connection
        if (
            _guarded_ensure_connection is not None
            and BaseDatabaseWrapper.ensure_connection is _guarded_ensure_connection
        ):
            BaseDatabaseWrapper.ensure_connection = _original_ensure_connection  # type: ignore[method-assign]
    else:
        BaseDatabaseWrapper.ensure_connection = _original_ensure_connection  # type: ignore[method-assign]

    _connection_guard_installed = False
    _guarded_ensure_connection = None


def connection_boundary_is_installed() -> bool:
    return _connection_guard_installed

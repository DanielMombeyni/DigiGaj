# Isolated SMS PostgreSQL test stack

## Status levels (do not conflate)

| Level | Meaning |
|-------|---------|
| **Static configuration** | Compose file + docs describe an intended isolated target. |
| **Fail-closed pytest guard** | DigiGaj backend pytest refuses DB work unless isolation is validated (collection + setup fixture + connection boundary). |
| **Runtime isolation verified** | A human completed the Docker/connectivity checklist on a running stack. **Not claimed by this document or by passing guard unit/lifecycle tests.** |

Passing mocked or subprocess guard tests does **not** prove that Compose project `digigaj-sms-test`, host port `55432`, or volume `digigaj_sms_pytest_pgdata` is running or correctly bound.

Compose project / database / volume names alone also do **not** prove isolation.

---

## Supported test invocation

| Supported | Notes |
|-----------|--------|
| `cd backend` then `.\.venv\Scripts\python.exe -m pytest ...` | Loads `backend/pytest.ini` + `backend/conftest.py` |
| Explicit file / node selection under `backend/app/tests/` | Same conftest discovery |

| Unsupported / bypasses the DigiGaj guard | Notes |
|------------------------------------------|--------|
| `pytest --noconftest` | Skips `backend/conftest.py` entirely — guard hooks never load |
| Alternate `-c` / rootdir that avoids `backend/conftest.py` | Guard may not load |
| `DIGIGAJ_ALLOW_NON_SMS_TEST_DB=1` without understanding the opt-out | Disables enforcement (only when SMS sentinel is **not** set) |
| Raw `psycopg` / non-Django sockets | Outside `BaseDatabaseWrapper.ensure_connection` |

There is **no** dedicated isolation runner in this phase. Enforcing a wrapper script that rejects `--noconftest` remains a separate follow-up task.

---

## Explicit activation (SMS isolation mode)

For any **database-dependent** DigiGaj backend pytest session, set **process** environment variables **before** starting pytest (so they win over `.env`; `read_env(..., overwrite=False)` will not replace already-set process vars):

```text
DIGIGAJ_SMS_TEST_DB=1
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=55432
POSTGRES_DB=sms_pytest
POSTGRES_USER=sms_pytest
POSTGRES_PASSWORD=<sms-test password from compose file only>
```

| Variable | Role |
|----------|------|
| `DIGIGAJ_SMS_TEST_DB=1` | Explicit SMS isolation sentinel (required for DB-backed SMS-isolated runs). |
| `POSTGRES_*` | Must match the sms-test target; compared to Django DB config / connection `settings_dict`. |
| `DIGIGAJ_ALLOW_NON_SMS_TEST_DB=1` | Opt-out for intentional **non-SMS** test DB sessions. **Incompatible** with `DIGIGAJ_SMS_TEST_DB=1` — both set → fail closed. |

Do not treat application `.env` alone as proof of isolation.  
Missing variables are **not** treated as permission to use the application database.

---

## What the guard validates

When enforcement is enabled:

1. Sentinel `DIGIGAJ_SMS_TEST_DB=1` (for DB-oriented work)
2. Explicit `POSTGRES_DB` / `USER` / `HOST` / `PORT` in the process environment
3. Target: DB=`sms_pytest`, user=`sms_pytest`, host∈{`127.0.0.1`,`::1`}, port=`55432`
4. Collection/setup: effective `settings.DATABASES["default"]` matches process `POSTGRES_*`
5. Connection boundary: **this wrapper’s** `settings_dict` must match (NAME may be `sms_pytest` or pytest-django’s `test_sms_pytest`)
6. Rejection of `gadgetstore` / `test_gadgetstore`, user `gadget`, port `5432`, non-loopback hosts

Errors never include passwords.

Implementation:

- `backend/app/tests/sms_db_isolation.py` — validation + connection boundary
- `backend/conftest.py` — collection hook, `django_db_modify_db_settings` (keeps `django_db_modify_db_settings_parallel_suffix`), session install/uninstall of the connection wrapper

---

## Protection layers

1. **Collection** (`pytest_collection_modifyitems`): if any item looks DB-oriented (`django_db` marker, fixtures `db` / `transactional_db` / `django_db_setup` / `live_server`, or `django.test.TransactionTestCase` / `TestCase`), validate or `pytest.exit`.  
   **Note:** `django_db_blocker` is **not** used for collection detection (pytest-django injects it widely via autouse). Unblock+connect is covered by the connection boundary.
2. **Setup fixture** (`django_db_modify_db_settings`): depends on pytest-django’s `django_db_modify_db_settings_parallel_suffix`, then validates immediately before `setup_databases()`.
3. **Connection boundary**: wraps the underlying `BaseDatabaseWrapper.ensure_connection` and validates **`self.settings_dict`** before any backend handshake. The installer updates pytest-django’s `DjangoDbBlocker._real_ensure_connection` so `unblock()` restores the **guarded** method rather than a pre-guard implementation.

### Connection-boundary limitations

- Does not prove the process on `127.0.0.1:55432` is the intended Compose volume.
- Disabled only by `DIGIGAJ_ALLOW_NON_SMS_TEST_DB=1` **without** the SMS sentinel.
- `--noconftest` / alternate config that skips DigiGaj conftest bypasses all layers.
- Native drivers outside Django’s `ensure_connection` are not wrapped.

---

## Static Compose target (not runtime proof)

| Item | Value |
|------|--------|
| Compose file | `docker-compose.sms-test.yml` |
| Project name | `digigaj-sms-test` |
| Container | `digigaj-sms-test-pg` |
| Volume | `digigaj_sms_pytest_pgdata` |
| Bind | `127.0.0.1:55432` → `5432` |
| Bootstrap DB / user | `sms_pytest` / `sms_pytest` |

---

## Database-free guard tests

From `backend` (no Postgres required; do **not** use `--noconftest`):

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_sms_db_isolation_guard.py app/tests/test_sms_db_isolation_lifecycle.py -v
.\.venv\Scripts\python.exe -m pytest app/tests/test_sms_order_created.py -v -m "not django_db"
```

---

## Safe print of resolved Django target (no password)

After exporting process overrides:

```powershell
.\.venv\Scripts\python.exe -c "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings'); import django; django.setup(); from django.conf import settings; d=settings.DATABASES['default']; print({k:d.get(k) for k in ('NAME','USER','HOST','PORT')})"
```

---

## Why `migrate` is dangerous without the same environment

`manage.py migrate` uses the same settings loading path. Without verified overrides, migrate can hit `gadgetstore` / port `5432`. Applying through `0028_sms_order_created_event` also applies `0027_product_display_priority` (linear dependency). Never migrate “for pytest” without the isolated stack + matching process env.

---

## Runtime checklist (separately authorized — not done by guard tests)

1. Docker Desktop running; `docker compose -f docker-compose.sms-test.yml ps` healthy.
2. Volume `digigaj_sms_pytest_pgdata` in use; not `postgres_data_dev` / `postgres_data_prod`.
3. Inspect bind: HostPort `55432` on `127.0.0.1` only.
4. Process env + safe Django printout agree with the sms-test target.
5. Only then: migrate (if needed) and `django_db` pytest.

Until then: **RUNTIME ISOLATION NOT PROVEN**.

---

## Example DB-backed pytest (only after runtime checklist)

```powershell
cd backend
$env:DIGIGAJ_SMS_TEST_DB = "1"
$env:POSTGRES_HOST = "127.0.0.1"
$env:POSTGRES_PORT = "55432"
$env:POSTGRES_DB = "sms_pytest"
$env:POSTGRES_USER = "sms_pytest"
$env:POSTGRES_PASSWORD = "<sms-test password from compose file only>"
# Do NOT set DIGIGAJ_ALLOW_NON_SMS_TEST_DB together with the sentinel.
.\.venv\Scripts\python.exe -m pytest app/tests/test_sms_order_created.py app/tests/test_sms_phase6_fixes.py app/tests/test_sms_dispatch_security.py -v
```

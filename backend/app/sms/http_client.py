from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger("app.sms")


def post_json(
    url: str,
    payload: dict,
    *,
    headers: dict | None = None,
    timeout: int = 20,
) -> tuple[dict | None, str | None]:
    body = json.dumps(payload).encode("utf-8")
    req_headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json",
    }
    if headers:
        req_headers.update(headers)
    request = urllib.request.Request(url, data=body, headers=req_headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            if not raw:
                return {}, None
            try:
                return json.loads(raw), None
            except json.JSONDecodeError:
                return {"raw": raw}, None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        logger.warning("SMS HTTP %s: %s", exc.code, raw[:300])
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"raw": raw}
        return data, f"خطای HTTP {exc.code}"
    except Exception as exc:
        logger.exception("SMS request failed")
        return None, str(exc) or "خطا در ارتباط با سرویس پیامک"


def post_form(
    url: str,
    payload: dict,
    *,
    timeout: int = 20,
) -> tuple[dict | None, str | None]:
    from urllib.parse import urlencode

    body = urlencode(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return json.loads(raw), None
            except json.JSONDecodeError:
                return {"raw": raw}, None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        logger.warning("SMS form HTTP %s: %s", exc.code, raw[:300])
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"raw": raw}
        return data, f"خطای HTTP {exc.code}"
    except Exception as exc:
        logger.exception("SMS form request failed")
        return None, str(exc) or "خطا در ارتباط با سرویس پیامک"

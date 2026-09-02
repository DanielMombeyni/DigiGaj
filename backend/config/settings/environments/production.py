DEBUG = False

import os

from app.utils.deploy_env import build_deploy_config, is_placeholder_public_url

_auto = os.environ.get("AUTO_DEPLOY_CONFIG", "1").strip().lower() not in ("0", "false", "no", "off")
_deploy = build_deploy_config() if _auto else None

if _deploy:
    ALLOWED_HOSTS = list(dict.fromkeys([*_deploy["allowed_hosts"], *ALLOWED_HOSTS]))
    CORS_ALLOWED_ORIGINS = list(dict.fromkeys([*_deploy["cors_origins"], *CORS_ALLOWED_ORIGINS]))
    CSRF_TRUSTED_ORIGINS = list(dict.fromkeys([*_deploy["csrf_origins"], *CSRF_TRUSTED_ORIGINS]))
    if is_placeholder_public_url(os.environ.get("FRONTEND_URL", "")):
        FRONTEND_URL = _deploy["frontend_url"]
    if is_placeholder_public_url(os.environ.get("PUBLIC_API_BASE", "")):
        PUBLIC_API_BASE = _deploy["public_api_base"]
    _tls_env = os.environ.get("TLS_ENABLED", "").strip().lower()
    if _tls_env in ("1", "true", "yes"):
        TLS_ENABLED = True
    elif _tls_env in ("0", "false", "no", "off"):
        TLS_ENABLED = False
    else:
        TLS_ENABLED = _deploy["tls_enabled"]
elif os.environ.get("TLS_ENABLED", "").strip().lower() in ("1", "true", "yes"):
    TLS_ENABLED = True
else:
    TLS_ENABLED = False

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

if TLS_ENABLED:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "false").strip().lower() in (
        "1",
        "true",
        "yes",
    )
else:
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SECURE_SSL_REDIRECT = False

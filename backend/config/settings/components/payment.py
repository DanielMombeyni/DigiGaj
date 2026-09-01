from config.settings.components.base import env

PUBLIC_API_BASE = env("PUBLIC_API_BASE", default="http://localhost:8000").rstrip("/")
APP_DEEP_LINK_SCHEME = env("APP_DEEP_LINK_SCHEME", default="gadgetstore")
TLS_ENABLED = env.bool("TLS_ENABLED", default=False)
CURRENCY = env("CURRENCY", default="IRR")

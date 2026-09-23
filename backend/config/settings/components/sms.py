"""Signal SMS (Transmitor) and related SMS provider settings."""

from config.settings.components.base import env

# Signal SMS / Transmitor — https://transmitor.signalads.com/document
# API key validity is 365 days; creating a new key expires the previous one.
SIGNAL_SMS_API_KEY = env("SIGNAL_SMS_API_KEY", default="").strip()
SIGNAL_SMS_FROM = env("SIGNAL_SMS_FROM", default="").strip()
SIGNAL_SMS_BASE_URL = env(
    "SIGNAL_SMS_BASE_URL",
    default="https://transmitor.signalads.com",
).rstrip("/")
SIGNAL_SMS_TIMEOUT = env.int("SIGNAL_SMS_TIMEOUT", default=20)

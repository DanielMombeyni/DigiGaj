from config.settings.components.base import env

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="gadgetstore"),
        "USER": env("POSTGRES_USER", default="gadget"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="gadget_secret"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {"connect_timeout": 10},
    }
}

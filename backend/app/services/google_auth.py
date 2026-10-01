"""Google OAuth2 authorization-code + PKCE. id_token is verified on the server."""

from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from app.models import UserProfile
from app.services.store_config import google_credentials

logger = logging.getLogger("app.auth")

User = get_user_model()

TOKEN_URL = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
_VERIFIER_RE = re.compile(r"^[A-Za-z0-9\-._~]{43,128}$")
_USERNAME_RE = re.compile(r"[^\w]+", re.UNICODE)


class GoogleAuthError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def _allowed_redirect(redirect_uri: str) -> bool:
    parsed = urlparse(str(redirect_uri or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    if parsed.path.rstrip("/") != "/login/google/callback":
        return False
    origin = f"{parsed.scheme}://{parsed.netloc}"
    allowed = set(getattr(settings, "CORS_ALLOWED_ORIGINS", []) or [])
    frontend = str(getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    if frontend:
        allowed.add(frontend)
    if settings.DEBUG:
        allowed.update(
            {
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            }
        )
    return origin in allowed


def _unique_username(email: str) -> str:
    local = email.split("@", 1)[0]
    base = _USERNAME_RE.sub("", local)[:20] or "user"
    candidate = base
    n = 0
    while User.objects.filter(username=candidate).exists():
        n += 1
        candidate = f"{base[:16]}{n}"
        if n > 50:
            candidate = f"u{email[:8]}"
            break
    return candidate[:150]


def verify_id_token(id_token: str, audience: str) -> dict:
    """Verify Google's id_token signature and claims. Falls back to tokeninfo."""
    claims = None
    try:
        claims = _verify_with_jwks(id_token, audience)
    except ImportError:
        claims = None
    except Exception:
        logger.info("local id_token verify unavailable; using Google tokeninfo")
        claims = None
    if claims is None:
        claims = _verify_with_tokeninfo(id_token, audience)
    _assert_claims(claims, audience)
    return claims


def _verify_with_jwks(id_token: str, audience: str) -> dict:
    import jwt
    from jwt import PyJWKClient

    jwks = PyJWKClient(JWKS_URL)
    key = jwks.get_signing_key_from_jwt(id_token)
    return jwt.decode(
        id_token,
        key.key,
        algorithms=["RS256"],
        audience=audience,
        issuer=list(GOOGLE_ISSUERS),
    )


def _verify_with_tokeninfo(id_token: str, audience: str) -> dict:
    try:
        response = requests.get(
            TOKENINFO_URL,
            params={"id_token": id_token},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise GoogleAuthError("تأیید هویت گوگل ناموفق بود.", status=502) from exc
    if response.status_code != 200:
        raise GoogleAuthError("توکن گوگل نامعتبر است.")
    try:
        data = response.json()
    except ValueError as exc:
        raise GoogleAuthError("پاسخ گوگل نامعتبر است.", status=502) from exc
    if not isinstance(data, dict) or data.get("error"):
        raise GoogleAuthError("توکن گوگل نامعتبر است.")
    if str(data.get("aud") or "") != audience:
        raise GoogleAuthError("مخاطب توکن گوگل با این فروشگاه یکی نیست.")
    return data


def _assert_claims(claims: dict, audience: str) -> None:
    aud = claims.get("aud")
    if isinstance(aud, (list, tuple)):
        ok_aud = audience in aud
    else:
        ok_aud = str(aud or "") == audience
    iss = str(claims.get("iss") or "")
    email_verified = claims.get("email_verified")
    verified = email_verified in (True, "true", "True", "1", 1)
    if not ok_aud or iss not in GOOGLE_ISSUERS or not verified:
        raise GoogleAuthError("توکن گوگل تأیید نشد.")
    if not str(claims.get("sub") or "").strip() or not str(claims.get("email") or "").strip():
        raise GoogleAuthError("گوگل ایمیل تأییدشده برنگرداند.")


def exchange_code(*, code: str, code_verifier: str, redirect_uri: str) -> dict:
    creds = google_credentials()
    if not creds["enabled"]:
        raise GoogleAuthError("ورود با گوگل غیرفعال است.")
    if not _VERIFIER_RE.fullmatch(code_verifier or ""):
        raise GoogleAuthError("درخواست ورود نامعتبر است.")
    if not _allowed_redirect(redirect_uri):
        raise GoogleAuthError("آدرس بازگشت نامعتبر است.")
    try:
        response = requests.post(
            TOKEN_URL,
            data={
                "code": code,
                "client_id": creds["client_id"],
                "client_secret": creds["client_secret"],
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        logger.warning("google token exchange failed: %s", exc.__class__.__name__)
        raise GoogleAuthError("ارتباط با گوگل برقرار نشد.", status=502) from exc
    if response.status_code != 200:
        logger.info("google token exchange rejected status=%s", response.status_code)
        raise GoogleAuthError("ورود گوگل تأیید نشد.")
    try:
        payload = response.json()
    except ValueError as exc:
        raise GoogleAuthError("پاسخ گوگل نامعتبر است.", status=502) from exc
    id_token = str(payload.get("id_token") or "")
    if not id_token:
        raise GoogleAuthError("گوگل شناسه کاربر برنگرداند.")
    return verify_id_token(id_token, creds["client_id"])


def link_google_account(claims: dict):
    """
    Attach a verified Google identity to an existing email, or create one account.
    Never creates a second user for the same email or the same Google sub.
    """
    sub = str(claims.get("sub") or "").strip()[:255]
    email = str(claims.get("email") or "").strip().lower()
    if not sub or not email:
        raise ValidationError({"detail": "حساب گوگل ناقص است."})

    first = str(claims.get("given_name") or "")[:150]
    last = str(claims.get("family_name") or "")[:150]

    with transaction.atomic():
        profile = (
            UserProfile.objects.select_related("user")
            .filter(google_sub=sub)
            .first()
        )
        if profile:
            return profile.user, False

        user = (
            User.objects.filter(email__iexact=email)
            .order_by("id")
            .first()
        )
        if user:
            row, _ = UserProfile.objects.get_or_create(user=user)
            if row.google_sub and row.google_sub != sub:
                raise ValidationError(
                    {"detail": "این ایمیل قبلاً به حساب گوگل دیگری متصل شده است."}
                )
            row.google_sub = sub
            try:
                row.save(update_fields=["google_sub", "updated_at"])
            except IntegrityError:
                linked = (
                    UserProfile.objects.select_related("user")
                    .filter(google_sub=sub)
                    .first()
                )
                if linked:
                    return linked.user, False
                raise
            return user, False

        username = _unique_username(email)
        user = None
        for _ in range(5):
            candidate = User(
                username=username,
                email=email,
                first_name=first,
                last_name=last,
            )
            candidate.set_unusable_password()
            try:
                candidate.save()
                user = candidate
                break
            except IntegrityError:
                username = _unique_username(email + str(_unique_username(email)))
        if user is None:
            raise ValidationError({"detail": "ساخت حساب گوگل ناموفق بود."})

        created = True
        earlier = (
            User.objects.filter(email__iexact=email).order_by("id").first()
        )
        if earlier and earlier.pk != user.pk:
            user.delete()
            user = earlier
            created = False

        row, _ = UserProfile.objects.get_or_create(user=user)
        if row.google_sub and row.google_sub != sub:
            raise ValidationError(
                {"detail": "این ایمیل قبلاً به حساب گوگل دیگری متصل شده است."}
            )
        row.google_sub = sub
        try:
            row.save(update_fields=["google_sub", "updated_at"])
        except IntegrityError:
            linked = (
                UserProfile.objects.select_related("user").filter(google_sub=sub).first()
            )
            if linked:
                return linked.user, False
            raise
        return user, created

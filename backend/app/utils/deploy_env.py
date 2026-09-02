"""Auto-detect production host/IP and optional Cloudflare origin TLS."""

from __future__ import annotations

import os
import socket
import subprocess
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from app.config.site import SITE_DOMAIN, domain_hosts

ROOT_DIR = Path(__file__).resolve().parents[3]
DEFAULT_SSL_DIRS = (
    ROOT_DIR / "deploy" / "ssl",
    Path("/etc/ssl/cloudflare"),
    Path("/ssl"),
)

CERT_KEY_PAIRS = (
    ("ssl-certificate.pem", "ssl-private.key"),
    ("origin.pem", "origin.key"),
    ("cloudflare-origin.pem", "cloudflare-origin.key"),
    ("cert.pem", "key.pem"),
    ("origin.crt", "origin.key"),
)

LOCAL_HOSTS = {"localhost", "127.0.0.1", "backend", "frontend", "proxy"}
_PLACEHOLDER_PUBLIC_URL_MARKERS = ("localhost", "127.0.0.1", "0.0.0.0")


def is_placeholder_public_url(value: str | None) -> bool:
    text = (value or "").strip().lower()
    if not text:
        return True
    return any(marker in text for marker in _PLACEHOLDER_PUBLIC_URL_MARKERS)


def _truthy(value: str | None, default: bool = True) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() not in {"0", "false", "no", "off"}


def _split_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def _is_ip(value: str) -> bool:
    try:
        socket.inet_aton(value)
        return True
    except OSError:
        return False


def detect_hostname() -> str:
    try:
        return socket.gethostname().strip() or "localhost"
    except OSError:
        return "localhost"


def detect_local_ips() -> list[str]:
    ips: set[str] = set()

    try:
        hostname = detect_hostname()
        if hostname:
            ips.add(hostname)
            try:
                ips.add(socket.gethostbyname(hostname))
            except OSError:
                pass
    except OSError:
        pass

    try:
        for info in socket.getaddrinfo(None, 0, socket.AF_INET, socket.SOCK_STREAM):
            addr = info[4][0]
            if addr and not addr.startswith("127."):
                ips.add(addr)
    except OSError:
        pass

    try:
        output = subprocess.check_output(["hostname", "-I"], text=True, timeout=2)
        for part in output.split():
            if part and not part.startswith("127."):
                ips.add(part.strip())
    except (OSError, subprocess.SubprocessError):
        pass

    return sorted(ips)


def detect_public_ip(timeout: float = 3.0) -> str | None:
    endpoints = (
        "https://api.ipify.org",
        "https://ifconfig.me/ip",
        "https://icanhazip.com",
    )
    for url in endpoints:
        try:
            with urlopen(url, timeout=timeout) as resp:
                value = resp.read().decode("utf-8", errors="ignore").strip()
            if value and _is_ip(value):
                return value
        except (URLError, OSError, TimeoutError, ValueError):
            continue
    return None


def _pem_has_marker(path: Path, begin_markers: tuple[str, ...]) -> bool:
    if not path.is_file() or path.stat().st_size == 0:
        return False
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    for line in text.splitlines():
        stripped = line.strip()
        if any(stripped.startswith(marker) for marker in begin_markers):
            return True
    return False


_CERT_BEGIN = ("-----BEGIN CERTIFICATE-----",)
_KEY_BEGIN = (
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN EC PRIVATE KEY-----",
)


def find_cloudflare_origin_cert() -> tuple[Path | None, Path | None]:
    env_cert = os.environ.get("CLOUDFLARE_ORIGIN_CERT", "").strip()
    env_key = os.environ.get("CLOUDFLARE_ORIGIN_KEY", "").strip()
    if env_cert and env_key:
        cert = Path(env_cert)
        key = Path(env_key)
        if _pem_has_marker(cert, _CERT_BEGIN) and _pem_has_marker(key, _KEY_BEGIN):
            return cert, key

    search_dirs: list[Path] = []
    for item in DEFAULT_SSL_DIRS:
        if item.is_dir():
            search_dirs.append(item)

    extra = os.environ.get("CLOUDFLARE_SSL_DIR", "").strip()
    if extra:
        extra_path = Path(extra)
        if extra_path.is_dir():
            search_dirs.append(extra_path)

    for directory in search_dirs:
        for cert_name, key_name in CERT_KEY_PAIRS:
            cert = directory / cert_name
            key = directory / key_name
            if _pem_has_marker(cert, _CERT_BEGIN) and _pem_has_marker(key, _KEY_BEGIN):
                return cert, key
    return None, None


def _origin_variants(host: str, tls: bool) -> list[str]:
    scheme = "https" if tls else "http"
    host = host.strip().lower()
    if not host:
        return []
    if host in LOCAL_HOSTS:
        return [f"{scheme}://{host}"]
    if _is_ip(host):
        return [f"{scheme}://{host}"]
    if host.startswith("www."):
        base = host[4:]
        return [f"{scheme}://{base}", f"{scheme}://www.{base}"]
    return [f"{scheme}://{host}", f"{scheme}://www.{host}"]


def build_deploy_config() -> dict:
    site_domain = os.environ.get("SITE_DOMAIN", SITE_DOMAIN).strip().lower()
    site_hosts = domain_hosts(site_domain)
    extra_hosts = list(
        dict.fromkeys([*_split_csv(os.environ.get("EXTRA_ALLOWED_HOSTS")), *site_hosts])
    )
    extra_origins = _split_csv(os.environ.get("EXTRA_CORS_ORIGINS"))

    hostname = detect_hostname()
    local_ips = detect_local_ips()
    public_ip = detect_public_ip()

    hosts: list[str] = []
    for value in [*extra_hosts, hostname, *( [public_ip] if public_ip else [] ), *local_ips, *sorted(LOCAL_HOSTS)]:
        if not value:
            continue
        cleaned = value.strip().lower()
        if cleaned.startswith("http://") or cleaned.startswith("https://"):
            cleaned = cleaned.split("://", 1)[1].split("/", 1)[0]
        cleaned = cleaned.split(":")[0]
        if cleaned and cleaned not in hosts:
            hosts.append(cleaned)

    cert, key = find_cloudflare_origin_cert()
    tls_enabled = cert is not None and key is not None
    if _truthy(os.environ.get("TLS_ENABLED"), default=tls_enabled):
        tls_enabled = True
    if os.environ.get("TLS_ENABLED", "").strip().lower() in {"0", "false", "no", "off"}:
        tls_enabled = False

    primary = site_domain or (
        extra_hosts[0].split(":")[0]
        if extra_hosts
        else public_ip or (local_ips[0] if local_ips else hostname)
    )
    primary = primary.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]

    scheme = "https" if tls_enabled else "http"
    env_api_base = os.environ.get("PUBLIC_API_BASE", "").strip()
    env_frontend = os.environ.get("FRONTEND_URL", "").strip()
    public_api_base = (
        f"{scheme}://{primary}" if is_placeholder_public_url(env_api_base) else env_api_base
    )
    frontend_url = (
        f"{scheme}://{primary}" if is_placeholder_public_url(env_frontend) else env_frontend
    )

    cors_origins: list[str] = []
    csrf_origins: list[str] = []
    origin_hosts = list(dict.fromkeys([*extra_hosts, primary, hostname, *( [public_ip] if public_ip else [] ), *local_ips]))

    for host in origin_hosts:
        host = host.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        if not host:
            continue
        for origin in _origin_variants(host, tls_enabled):
            if origin not in cors_origins:
                cors_origins.append(origin)
                csrf_origins.append(origin)
        if not tls_enabled:
            for origin in _origin_variants(host, tls=True):
                if origin not in csrf_origins:
                    csrf_origins.append(origin)

    for origin in extra_origins:
        if origin not in cors_origins:
            cors_origins.append(origin)
        if origin not in csrf_origins:
            csrf_origins.append(origin)

    return {
        "allowed_hosts": hosts,
        "cors_origins": cors_origins,
        "csrf_origins": csrf_origins,
        "public_api_base": public_api_base.rstrip("/"),
        "frontend_url": frontend_url.rstrip("/"),
        "tls_enabled": tls_enabled,
        "primary_host": primary,
        "site_domain": site_domain or SITE_DOMAIN,
        "public_ip": public_ip or "",
        "local_ips": local_ips,
        "hostname": hostname,
        "ssl_cert": str(cert) if cert else "",
        "ssl_key": str(key) if key else "",
    }


def apply_deploy_env_overrides() -> dict:
    """Fill unset process env vars from auto-detected deploy config."""
    if not _truthy(os.environ.get("AUTO_DEPLOY_CONFIG"), default=True):
        return {}

    cfg = build_deploy_config()
    mapping = {
        "DJANGO_ALLOWED_HOSTS": ",".join(cfg["allowed_hosts"]),
        "CORS_ALLOWED_ORIGINS": ",".join(cfg["cors_origins"]),
        "CSRF_TRUSTED_ORIGINS": ",".join(cfg["csrf_origins"]),
        "PUBLIC_API_BASE": cfg["public_api_base"],
        "FRONTEND_URL": cfg["frontend_url"],
        "TLS_ENABLED": "true" if cfg["tls_enabled"] else "false",
        "DEPLOY_PRIMARY_HOST": cfg["primary_host"],
        "DEPLOY_PUBLIC_IP": cfg["public_ip"],
        "SITE_DOMAIN": cfg.get("site_domain") or SITE_DOMAIN,
    }
    placeholder_keys = {"PUBLIC_API_BASE", "FRONTEND_URL"}
    for key, value in mapping.items():
        current = os.environ.get(key, "").strip()
        if not current or (key in placeholder_keys and is_placeholder_public_url(current)):
            os.environ[key] = value
    return cfg

#!/usr/bin/env python
"""Write auto-detected production env to runtime/deploy.env (used at container start)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from app.utils.deploy_env import apply_deploy_env_overrides, build_deploy_config  # noqa: E402


def main() -> int:
    if os.environ.get("DJANGO_ENV", "").strip().lower() != "production":
        print("detect_deploy_env: skipped (not production)")
        return 0
    if os.environ.get("AUTO_DEPLOY_CONFIG", "1").strip().lower() in {"0", "false", "no", "off"}:
        print("detect_deploy_env: skipped (AUTO_DEPLOY_CONFIG=0)")
        return 0

    cfg = apply_deploy_env_overrides()
    runtime_dir = BASE_DIR / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    env_path = runtime_dir / "deploy.env"

    lines = [
        f"DJANGO_ALLOWED_HOSTS={os.environ.get('DJANGO_ALLOWED_HOSTS', '')}",
        f"CORS_ALLOWED_ORIGINS={os.environ.get('CORS_ALLOWED_ORIGINS', '')}",
        f"CSRF_TRUSTED_ORIGINS={os.environ.get('CSRF_TRUSTED_ORIGINS', '')}",
        f"PUBLIC_API_BASE={os.environ.get('PUBLIC_API_BASE', '')}",
        f"FRONTEND_URL={os.environ.get('FRONTEND_URL', '')}",
        f"TLS_ENABLED={os.environ.get('TLS_ENABLED', 'false')}",
        f"DEPLOY_PRIMARY_HOST={cfg.get('primary_host', '')}",
        f"DEPLOY_PUBLIC_IP={cfg.get('public_ip', '')}",
        f"DEPLOY_SSL_CERT={cfg.get('ssl_cert', '')}",
        f"DEPLOY_SSL_KEY={cfg.get('ssl_key', '')}",
    ]
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    mode = "HTTPS (Cloudflare origin cert)" if cfg.get("tls_enabled") else "HTTP"
    print(f"detect_deploy_env: {mode}")
    print(f"  primary host: {cfg.get('primary_host')}")
    if cfg.get("public_ip"):
        print(f"  public IP:    {cfg.get('public_ip')}")
    print(f"  allowed:      {', '.join(cfg.get('allowed_hosts', [])[:8])}")
    if cfg.get("ssl_cert"):
        print(f"  ssl cert:     {cfg.get('ssl_cert')}")
    print(f"  wrote:        {env_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

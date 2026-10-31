#!/usr/bin/env python3
"""Restore a transfer backup into a fresh production Compose project only."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
DOMAIN = "digigadg.ir"
SERVER_IP = "87.107.54.205"
BACKUP_FILES = {"database.dump", "media.tar.gz", "config.tar.gz"}
SSL_PAIRS = (
    ("ssl-certificate.pem", "ssl-private.key"),
    ("origin.pem", "origin.key"),
    ("cloudflare-origin.pem", "cloudflare-origin.key"),
    ("cert.pem", "key.pem"),
    ("origin.crt", "origin.key"),
)


class RestoreError(Exception):
    """A failed prerequisite or restore step that must stop the workflow."""


def checked(command: list[str], *, capture: bool = False, stdin=None) -> str:
    result = subprocess.run(
        command,
        cwd=ROOT,
        stdin=stdin,
        capture_output=capture,
        text=capture,
        check=False,
    )
    if result.returncode:
        # Captured Compose configuration may contain secrets: never echo it.
        raise RestoreError(
            f"Command failed: {command[0]} {command[1]} (exit {result.returncode})"
        )
    return result.stdout if capture else ""


def compose(*args: str, capture: bool = False, stdin=None) -> str:
    return checked(
        ["docker", "compose", "-f", str(ROOT / "docker-compose.prod.yml"), *args],
        capture=capture,
        stdin=stdin,
    )


def archive_members(archive: tarfile.TarFile) -> list[tarfile.TarInfo]:
    members = archive.getmembers()
    seen = set()
    for member in members:
        path = PurePosixPath(member.name)
        if (
            path.is_absolute()
            or ".." in path.parts
            or "\\" in member.name
            or ":" in member.name
        ):
            raise RestoreError("Unsafe path in backup archive")
        if not (member.isfile() or member.isdir()) or path in seen:
            raise RestoreError(
                "Links, special files and duplicate paths are not supported in backups"
            )
        seen.add(path)
    return members


def unpack(archive_path: Path, destination: Path) -> None:
    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive_members(archive)
        for member in members:
            target = destination.joinpath(*PurePosixPath(member.name).parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o600)


def backup_directory(paths: list[Path], staging: Path) -> Path:
    if len(paths) == 3:
        staging.mkdir()
        for name, source in zip(
            ("database.dump", "media.tar.gz", "config.tar.gz"), paths
        ):
            if source.is_symlink() or not source.is_file():
                raise RestoreError("Backup inputs must be regular files")
            shutil.copyfile(source, staging / name)
        return staging
    if len(paths) != 1:
        raise RestoreError(
            "Provide one transfer archive/directory, or database.dump media.tar.gz config.tar.gz"
        )
    source = paths[0]
    if source.is_symlink():
        raise RestoreError("A backup input must not be a symbolic link")
    if source.is_dir():
        return source
    if not source.is_file():
        raise RestoreError("Backup path does not exist")
    staging.mkdir()
    unpack(source, staging)
    candidates = [
        p.parent
        for p in staging.rglob("database.dump")
        if BACKUP_FILES <= {f.name for f in p.parent.iterdir()}
    ]
    if len(candidates) != 1:
        raise RestoreError(
            "Transfer archive must contain exactly one complete backup directory"
        )
    return candidates[0]


def validate_backup(backup: Path, config_dir: Path) -> None:
    for name in BACKUP_FILES:
        path = backup / name
        if path.is_symlink() or not path.is_file() or not path.stat().st_size:
            raise RestoreError(f"Missing or empty regular backup file: {name}")
    with (backup / "database.dump").open("rb") as source:
        if source.read(5) != b"PGDMP":
            raise RestoreError("database.dump must be the pg_dump custom-format backup")
    with tarfile.open(backup / "media.tar.gz", "r:gz") as archive:
        archive_members(archive)
        # Read every file so truncated/corrupt media is caught before DB restore.
        for member in archive.getmembers():
            if member.isfile():
                with archive.extractfile(member) as source:
                    while source.read(1024 * 1024):
                        pass
    config_dir.mkdir()
    unpack(backup / "config.tar.gz", config_dir)
    if not (config_dir / ".env").is_file():
        raise RestoreError("config.tar.gz must contain the original .env")


def ssl_pair(directory: Path) -> tuple[Path, Path] | None:
    if directory.is_symlink():
        raise RestoreError("SSL directory must not be a symbolic link")
    for cert_name, key_name in SSL_PAIRS:
        cert, key = directory / cert_name, directory / key_name
        if (
            not cert.is_file()
            or not key.is_file()
            or cert.is_symlink()
            or key.is_symlink()
        ):
            continue
        commands = [
            # x509 -checkhost exits zero even on mismatch in some OpenSSL
            # versions. verify returns a failing status for hostname/date errors.
            [
                "openssl",
                "verify",
                "-trusted",
                str(cert),
                "-partial_chain",
                "-verify_hostname",
                DOMAIN,
                str(cert),
            ],
            ["openssl", "x509", "-in", str(cert), "-noout", "-checkend", "0"],
        ]
        if any(
            subprocess.run(c, capture_output=True, check=False).returncode
            for c in commands
        ):
            continue
        certificate_key = subprocess.run(
            ["openssl", "x509", "-in", str(cert), "-pubkey", "-noout"],
            capture_output=True,
            check=False,
        )
        private_key = subprocess.run(
            ["openssl", "pkey", "-in", str(key), "-passin", "pass:", "-pubout"],
            capture_output=True,
            check=False,
        )
        if (
            certificate_key.returncode == private_key.returncode == 0
            and certificate_key.stdout == private_key.stdout
        ):
            return cert, key
    return None


def migrated_env(original: str, *, http_only: bool) -> str:
    scheme = "http" if http_only else "https"
    updates = {
        "DJANGO_ENV": "production",
        "DJANGO_DEBUG": "False",
        "SITE_DOMAIN": DOMAIN,
        "PUBLIC_SERVER_IP": SERVER_IP,
        "PUBLIC_API_BASE": f"{scheme}://{DOMAIN}",
        "FRONTEND_URL": f"{scheme}://{DOMAIN}",
        "DJANGO_ALLOWED_HOSTS": f"{DOMAIN},www.{DOMAIN},{SERVER_IP},localhost,127.0.0.1,backend",
        "CORS_ALLOWED_ORIGINS": f"{scheme}://{DOMAIN},{scheme}://www.{DOMAIN}",
        "CSRF_TRUSTED_ORIGINS": f"https://{DOMAIN},https://www.{DOMAIN},http://{DOMAIN},http://www.{DOMAIN}",
        "POSTGRES_HOST": "db",
        "POSTGRES_PORT": "5432",
        "REDIS_URL": "redis://redis:6379/0",
        "CELERY_BROKER_URL": "redis://redis:6379/1",
        "CELERY_RESULT_BACKEND": "redis://redis:6379/2",
        "FRONTEND_HTML_URL": "http://frontend/index.html",
        "RUN_SEED": "0",
        "SKIP_SEED": "1",
        "AUTO_DEPLOY_CONFIG": "1",
        "TLS_ENABLED": "false" if http_only else "true",
        "PUBLIC_SCHEME": scheme,
        "DISABLE_ORIGIN_TLS": "1" if http_only else "0",
        "CLOUDFLARE_ORIGIN_CERT": (
            "" if http_only else "/etc/ssl/cloudflare/ssl-certificate.pem"
        ),
        "CLOUDFLARE_ORIGIN_KEY": (
            "" if http_only else "/etc/ssl/cloudflare/ssl-private.key"
        ),
    }
    lines = []
    for line in original.splitlines():
        match = re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if not match or match[1] not in updates:
            lines.append(line)
    lines.extend(f"{key}={value}" for key, value in updates.items())
    return "\n".join(lines) + "\n"


def require_fresh_destination(config: dict) -> None:
    project = config["name"]
    containers = checked(
        [
            "docker",
            "ps",
            "-aq",
            "--filter",
            f"label=com.docker.compose.project={project}",
        ],
        capture=True,
    )
    if containers.strip():
        raise RestoreError(
            "Destination already has Compose containers; restore is only for a fresh server/project"
        )
    existing = set(
        checked(
            ["docker", "volume", "ls", "--format", "{{.Name}}"], capture=True
        ).splitlines()
    )
    target_names = {value["name"] for value in config["volumes"].values()}
    if existing & target_names:
        raise RestoreError(
            "Destination volumes already exist; refusing to overwrite or delete them"
        )
    backend = config["services"]["backend"]["environment"]
    database = config["services"]["db"]["environment"]
    for key in ("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"):
        if backend.get(key) != database.get(key):
            raise RestoreError(
                f"Backend/database {key} mismatch; remove conflicting shell environment overrides"
            )
    if backend.get("SKIP_SEED") != "1" or backend.get("RUN_SEED") != "0":
        raise RestoreError("Destination must disable all seeds during migration")
    if backend.get("SITE_DOMAIN") != DOMAIN:
        raise RestoreError("Compose must target digigadg.ir")


def restore(
    backup: Path, config_dir: Path, *, http_only: bool, start_workers: bool
) -> None:
    chosen_ssl = None
    if not http_only:
        chosen_ssl = ssl_pair(ROOT / "deploy" / "ssl") or ssl_pair(
            config_dir / "deploy" / "ssl"
        )
        if not chosen_ssl:
            raise RestoreError(
                f"Install an unexpired matching certificate/key for {DOMAIN} in deploy/ssl first, or use --http-only"
            )
    env_path = ROOT / ".env"
    if env_path.is_symlink():
        raise RestoreError("Destination .env must not be a symbolic link")
    original_env = env_path.read_bytes() if env_path.exists() else None
    new_env = migrated_env(
        (config_dir / ".env").read_text(encoding="utf-8-sig"), http_only=http_only
    )
    env_path.write_text(new_env, encoding="utf-8")
    env_path.chmod(0o600)
    try:
        config = json.loads(compose("config", "--format", "json", capture=True))
        require_fresh_destination(config)
    except (RestoreError, ValueError, KeyError):
        if original_env is None:
            env_path.unlink()
        else:
            env_path.write_bytes(original_env)
        raise

    receipt = (
        ROOT
        / ".restore-state"
        / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    )
    receipt.mkdir(parents=True, mode=0o700)
    if original_env is not None:
        (receipt / "env.before").write_bytes(original_env)
        (receipt / "env.before").chmod(0o600)
    # Never restore old Compose/nginx/scripts from config.tar.gz over new code.
    if (config_dir / "backend" / ".env").exists():
        backend_env = ROOT / "backend" / ".env"
        if backend_env.is_symlink():
            raise RestoreError("Destination backend/.env must not be a symbolic link")
        if backend_env.exists():
            shutil.copyfile(backend_env, receipt / "backend-env.before")
        shutil.copyfile(config_dir / "backend" / ".env", backend_env)
        backend_env.chmod(0o600)
    ssl_dir = ROOT / "deploy" / "ssl"
    if chosen_ssl:
        for source, name in zip(chosen_ssl, SSL_PAIRS[0]):
            target = ssl_dir / name
            if ssl_dir.is_symlink() or target.is_symlink():
                raise RestoreError("Destination SSL paths must not be symbolic links")
            ssl_dir.mkdir(exist_ok=True)
            if target.exists():
                shutil.copyfile(target, receipt / name)
            if source.resolve() != target.resolve():
                shutil.copyfile(source, target)
            target.chmod(0o600)
    print("Building images; no application services or seeds are started.", flush=True)
    compose("build")
    compose("up", "-d", "--wait", "db", "redis")
    with (backup / "database.dump").open("rb") as source:
        compose("exec", "-T", "db", "pg_restore", "--list", stdin=source, capture=True)
    with (backup / "database.dump").open("rb") as source:
        compose(
            "exec",
            "-T",
            "db",
            "sh",
            "-ec",
            'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error --single-transaction',
            stdin=source,
        )
    with (backup / "media.tar.gz").open("rb") as source:
        compose(
            "run",
            "--rm",
            "-T",
            "--no-deps",
            "--entrypoint",
            "tar",
            "backend",
            "-xzf",
            "-",
            "--no-same-owner",
            "--no-same-permissions",
            "-C",
            "/app/media",
            stdin=source,
        )
    for command in (
        ("migrate", "--noinput"),
        ("set_site_domain", DOMAIN),
        ("collectstatic", "--noinput"),
        ("check",),
    ):
        compose(
            "run",
            "--rm",
            "-T",
            "--no-deps",
            "--entrypoint",
            "python",
            "backend",
            "manage.py",
            *command,
        )
    compose("up", "-d", "--no-deps", "--wait", "backend", "frontend", "proxy")
    if start_workers:
        compose("up", "-d", "--no-deps", "--wait", "celery", "celery-beat")
    (receipt / "complete.txt").write_text(
        f"Restored to {DOMAIN}\nWorkers started: {start_workers}\n", encoding="utf-8"
    )
    print(
        f"Restore complete. Local web services started for {DOMAIN}; DNS/public HTTPS is not verified."
    )
    if not start_workers:
        print(
            "Celery/beat remain stopped. After cutover: ./docker.sh Production up celery celery-beat"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument(
        "--http-only",
        action="store_true",
        help="Use HTTP without importing old SSL files",
    )
    parser.add_argument(
        "--start-workers",
        action="store_true",
        help="Start Celery/beat after restore (may send notifications)",
    )
    args = parser.parse_args(argv)
    lock = ROOT / ".restore-state" / "restore.lock"
    owned_lock = False
    try:
        for executable in ("docker",) if args.http_only else ("docker", "openssl"):
            if not shutil.which(executable):
                raise RestoreError(
                    f"Install {executable} on the destination server first"
                )
        checked(["docker", "info"], capture=True)
        lock.parent.mkdir(exist_ok=True, mode=0o700)
        try:
            descriptor = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            raise RestoreError(
                "Another restore is running, or a previous run left .restore-state/restore.lock; inspect it before retrying"
            ) from None
        os.close(descriptor)
        owned_lock = True
        with tempfile.TemporaryDirectory(prefix="digigaj-restore-") as directory:
            staging = Path(directory)
            backup = backup_directory(
                [p.absolute() for p in args.paths], staging / "backup"
            )
            validate_backup(backup, staging / "config")
            restore(
                backup,
                staging / "config",
                http_only=args.http_only,
                start_workers=args.start_workers,
            )
        return 0
    except (RestoreError, OSError, tarfile.TarError, ValueError, KeyError) as exc:
        print(
            f"Restore stopped: {exc}\nNo automatic volume deletion or rollback is performed. Keep the old server and backup intact.",
            file=sys.stderr,
        )
        return 1
    finally:
        if owned_lock:
            lock.unlink()


if __name__ == "__main__":
    raise SystemExit(main())

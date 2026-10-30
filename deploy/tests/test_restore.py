"""Host-side restore regressions: fake Docker only, never a real database."""

import io
import json
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from deploy import restore as migration


def make_tar(path, entries):
    with tarfile.open(path, "w:gz") as archive:
        for name, content in entries.items():
            member = tarfile.TarInfo(name)
            member.size = len(content)
            archive.addfile(member, io.BytesIO(content))


def make_backup(root):
    backup = root / "source"
    backup.mkdir()
    (backup / "database.dump").write_bytes(b"PGDMPmock")
    make_tar(backup / "media.tar.gz", {"./products/photo.jpg": b"image"})
    make_tar(
        backup / "config.tar.gz",
        {
            ".env": b"DJANGO_SECRET_KEY=original-secret\nPOSTGRES_DB=shop\nPOSTGRES_USER=shop\nPOSTGRES_PASSWORD=original-password\nSITE_DOMAIN=digigadg.com\n",
            "docker-compose.prod.yml": b"MUST NOT OVERWRITE NEW COMPOSE",
            "deploy/nginx/http.conf": b"MUST NOT OVERWRITE NEW NGINX",
        },
    )
    return backup


def compose_config():
    shared = {
        "POSTGRES_DB": "shop",
        "POSTGRES_USER": "shop",
        "POSTGRES_PASSWORD": "original-password",
    }
    return {
        "name": "digigaj",
        "volumes": {
            name: {"name": f"digigaj_{name}"}
            for name in (
                "postgres_data_prod",
                "media_prod",
                "redis_data_prod",
                "static_prod",
            )
        },
        "services": {
            "db": {"environment": shared},
            "backend": {
                "environment": {
                    **shared,
                    "SKIP_SEED": "1",
                    "RUN_SEED": "0",
                    "SITE_DOMAIN": "digigadg.ir",
                }
            },
        },
    }


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def test_env_preserves_secrets_and_removes_duplicate_old_settings(self):
        source = "DJANGO_SECRET_KEY=keep-me\nPOSTGRES_PASSWORD='a=b#c'\nSITE_DOMAIN=digigadg.com\nexport SITE_DOMAIN=old\nRUN_SEED=1\n"
        result = migration.migrated_env(source, http_only=False)
        self.assertIn("DJANGO_SECRET_KEY=keep-me", result)
        self.assertIn("POSTGRES_PASSWORD='a=b#c'", result)
        self.assertEqual(result.count("SITE_DOMAIN="), 1)
        self.assertIn("SITE_DOMAIN=digigadg.ir", result)
        self.assertIn("SKIP_SEED=1", result)
        self.assertIn("RUN_SEED=0", result)
        self.assertIn("PUBLIC_SCHEME=https", result)
        self.assertNotIn("digigadg.com", result)

    def test_http_mode_updates_canonical_scheme_and_disables_origin_tls(self):
        result = migration.migrated_env("", http_only=True)
        self.assertIn("PUBLIC_API_BASE=http://digigadg.ir", result)
        self.assertIn("TLS_ENABLED=false", result)
        self.assertIn("DISABLE_ORIGIN_TLS=1", result)

    def test_archive_traversal_and_absolute_names_rejected(self):
        for name in (
            "../escape",
            "/absolute",
            "a/../../escape",
            "a\\escape",
            "C:/escape",
        ):
            with self.subTest(name=name):
                path = self.root / "bad.tar.gz"
                make_tar(path, {name: b"bad"})
                with self.assertRaises(migration.RestoreError):
                    migration.unpack(path, self.root / "output")
        self.assertFalse((self.root / "escape").exists())

    def test_links_special_files_and_duplicates_rejected(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE):
            path = self.root / "links.tar.gz"
            with tarfile.open(path, "w:gz") as archive:
                member = tarfile.TarInfo("escape")
                member.type = kind
                member.linkname = "/etc/passwd"
                archive.addfile(member)
            with self.assertRaises(migration.RestoreError):
                migration.unpack(path, self.root / "output")
        with tarfile.open(path, "w:gz") as archive:
            for _ in range(2):
                archive.addfile(tarfile.TarInfo("duplicate"))
        with self.assertRaises(migration.RestoreError):
            migration.unpack(path, self.root / "output")

    def test_combined_directory_and_three_file_inputs(self):
        backup = make_backup(self.root)
        migration.validate_backup(backup, self.root / "config")
        self.assertEqual(
            migration.backup_directory([backup], self.root / "unused"), backup
        )
        copied = migration.backup_directory(
            [
                backup / name
                for name in ("database.dump", "media.tar.gz", "config.tar.gz")
            ],
            self.root / "copied",
        )
        self.assertEqual((copied / "database.dump").read_bytes(), b"PGDMPmock")
        bundle = self.root / "transfer.tar.gz"
        with tarfile.open(bundle, "w:gz") as archive:
            archive.add(backup, arcname="digigaj-backup.123")
        unpacked = migration.backup_directory([bundle], self.root / "unpacked")
        self.assertEqual(unpacked.name, "digigaj-backup.123")
        self.assertTrue((unpacked / "config.tar.gz").exists())

    def test_bad_dump_and_corrupt_media_fail_before_docker(self):
        backup = make_backup(self.root)
        (backup / "database.dump").write_bytes(b"not a custom dump")
        with self.assertRaises(migration.RestoreError):
            migration.validate_backup(backup, self.root / "config")
        (backup / "database.dump").write_bytes(b"PGDMPmock")
        (backup / "media.tar.gz").write_bytes(b"broken gzip")
        with self.assertRaises(tarfile.TarError):
            migration.validate_backup(backup, self.root / "config")

    def test_existing_containers_and_volumes_refused(self):
        config = compose_config()
        with patch.object(
            migration, "checked", return_value="container-id"
        ), self.assertRaisesRegex(migration.RestoreError, "containers"):
            migration.require_fresh_destination(config)
        with patch.object(
            migration, "checked", side_effect=["", "digigaj_postgres_data_prod\n"]
        ), self.assertRaisesRegex(migration.RestoreError, "volumes"):
            migration.require_fresh_destination(config)

    def test_conflicting_credentials_and_enabled_seeds_refused(self):
        config = compose_config()
        config["services"]["backend"]["environment"]["POSTGRES_USER"] = "other"
        with patch.object(migration, "checked", return_value=""):
            with self.assertRaisesRegex(migration.RestoreError, "mismatch"):
                migration.require_fresh_destination(config)
            config = compose_config()
            config["services"]["backend"]["environment"]["SKIP_SEED"] = "0"
            with self.assertRaisesRegex(migration.RestoreError, "seeds"):
                migration.require_fresh_destination(config)

    def prepare_destination(self):
        destination = self.root / "destination"
        (destination / "deploy" / "ssl").mkdir(parents=True)
        (destination / "backend").mkdir()
        (destination / "docker-compose.prod.yml").write_text("trusted compose")
        backup = make_backup(self.root)
        config_dir = self.root / "config"
        migration.validate_backup(backup, config_dir)
        return destination, backup, config_dir

    def test_restore_order_no_seed_no_worker_or_code_overwrite(self):
        destination, backup, config_dir = self.prepare_destination()
        commands = []

        def compose(*args, **kwargs):
            commands.append(args)
            return json.dumps(compose_config()) if args[0] == "config" else ""

        with patch.object(migration, "ROOT", destination), patch.object(
            migration, "compose", side_effect=compose
        ), patch.object(migration, "checked", return_value=""):
            migration.restore(backup, config_dir, http_only=True, start_workers=False)
        all_commands = "\n".join(" ".join(c) for c in commands)
        self.assertLess(
            all_commands.index("--single-transaction"), all_commands.index("/app/media")
        )
        self.assertLess(
            all_commands.index("/app/media"), all_commands.index("manage.py migrate")
        )
        self.assertIn("manage.py set_site_domain digigadg.ir", all_commands)
        self.assertIn("--no-same-owner", all_commands)
        self.assertNotIn("seed_bootstrap", all_commands)
        self.assertNotIn("celery", all_commands)
        self.assertNotIn("--clean", all_commands)
        self.assertNotIn("down", all_commands)
        self.assertEqual(
            (destination / "docker-compose.prod.yml").read_text(), "trusted compose"
        )
        self.assertIn("original-secret", (destination / ".env").read_text())
        self.assertTrue(list((destination / ".restore-state").glob("*/complete.txt")))

    def test_restore_preflight_failure_restores_original_env(self):
        destination, backup, config_dir = self.prepare_destination()
        (destination / ".env").write_text("ORIGINAL=yes\n")
        with patch.object(migration, "ROOT", destination), patch.object(
            migration, "compose", return_value=json.dumps(compose_config())
        ), patch.object(
            migration, "checked", return_value="existing-container"
        ), self.assertRaises(
            migration.RestoreError
        ):
            migration.restore(backup, config_dir, http_only=True, start_workers=False)
        self.assertEqual((destination / ".env").read_text(), "ORIGINAL=yes\n")

    def test_restore_failure_never_starts_web_or_workers(self):
        destination, backup, config_dir = self.prepare_destination()
        commands = []

        def compose(*args, **kwargs):
            commands.append(args)
            if "--single-transaction" in " ".join(args):
                raise migration.RestoreError("Mock restore failure")
            return json.dumps(compose_config()) if args[0] == "config" else ""

        with patch.object(migration, "ROOT", destination), patch.object(
            migration, "compose", side_effect=compose
        ), patch.object(migration, "checked", return_value=""), self.assertRaises(
            migration.RestoreError
        ):
            migration.restore(backup, config_dir, http_only=True, start_workers=True)
        self.assertNotIn("proxy", " ".join(" ".join(c) for c in commands))
        self.assertNotIn("celery", " ".join(" ".join(c) for c in commands))

    def test_start_workers_only_when_explicit(self):
        destination, backup, config_dir = self.prepare_destination()
        with patch.object(migration, "ROOT", destination), patch.object(
            migration, "compose", return_value=json.dumps(compose_config())
        ) as compose, patch.object(migration, "checked", return_value=""):
            migration.restore(backup, config_dir, http_only=True, start_workers=True)
        self.assertEqual(compose.call_args.args[-2:], ("celery", "celery-beat"))

    def test_ssl_rejects_hostname_mismatch(self):
        cert, key = self.root / "cert.pem", self.root / "key.pem"
        cert.write_text("cert")
        key.write_text("key")
        with patch.object(
            migration.subprocess, "run", return_value=subprocess.CompletedProcess([], 2)
        ):
            self.assertIsNone(migration.ssl_pair(self.root))

    @unittest.skipUnless(shutil.which("openssl"), "OpenSSL not installed")
    def test_real_certificate_hostname_and_private_key_matching(self):
        cert, key = self.root / "cert.pem", self.root / "key.pem"
        for domain in ("digigadg.com", "digigadg.ir"):
            subprocess.run(
                [
                    "openssl",
                    "req",
                    "-x509",
                    "-newkey",
                    "rsa:2048",
                    "-nodes",
                    "-keyout",
                    str(key),
                    "-out",
                    str(cert),
                    "-days",
                    "1",
                    "-subj",
                    f"/CN={domain}",
                    "-addext",
                    f"subjectAltName=DNS:{domain}",
                ],
                check=True,
                capture_output=True,
            )
            pair = migration.ssl_pair(self.root)
            if domain == "digigadg.com":
                self.assertIsNone(pair)
            else:
                self.assertEqual(pair, (cert, key))
        key.write_text("invalid private key")
        self.assertIsNone(migration.ssl_pair(self.root))


if __name__ == "__main__":
    unittest.main()

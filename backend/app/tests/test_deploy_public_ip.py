"""Explicit production origin must work without external IP discovery."""

from unittest.mock import patch

import pytest

from app.utils import deploy_env


def test_explicit_origin_skips_external_ip_services(monkeypatch):
    monkeypatch.setenv("PUBLIC_SERVER_IP", "87.107.54.205")
    with patch.object(deploy_env, "urlopen") as network:
        assert deploy_env.detect_public_ip() == "87.107.54.205"
    network.assert_not_called()


def test_invalid_explicit_origin_fails_before_network(monkeypatch):
    monkeypatch.setenv("PUBLIC_SERVER_IP", "not-an-ip")
    with patch.object(deploy_env, "urlopen") as network, pytest.raises(ValueError):
        deploy_env.detect_public_ip()
    network.assert_not_called()


def test_origin_enters_allowed_hosts_without_changing_canonical_domain(monkeypatch):
    monkeypatch.setenv("PUBLIC_SERVER_IP", "87.107.54.205")
    monkeypatch.setenv("SITE_DOMAIN", "digigadg.ir")
    monkeypatch.setenv("PUBLIC_API_BASE", "https://digigadg.ir")
    monkeypatch.setenv("FRONTEND_URL", "https://digigadg.ir")
    monkeypatch.setenv("TLS_ENABLED", "false")
    with patch.object(
        deploy_env, "detect_hostname", return_value="new-origin"
    ), patch.object(deploy_env, "detect_local_ips", return_value=[]), patch.object(
        deploy_env, "find_cloudflare_origin_cert", return_value=(None, None)
    ), patch.object(
        deploy_env, "urlopen"
    ) as network:
        config = deploy_env.build_deploy_config()
    assert config["public_ip"] == "87.107.54.205"
    assert "87.107.54.205" in config["allowed_hosts"]
    assert config["frontend_url"] == "https://digigadg.ir"
    assert config["public_api_base"] == "https://digigadg.ir"
    assert "http://87.107.54.205" in config["cors_origins"]
    network.assert_not_called()

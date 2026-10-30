"""Domain migration command is tested without opening database connections."""

from unittest.mock import patch

import pytest
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError


def test_site_domain_updates_only_current_site():
    with patch(
        "app.management.commands.set_site_domain.Site.objects.update_or_create"
    ) as update, patch(
        "app.management.commands.set_site_domain.Site.objects.clear_cache"
    ) as clear:
        call_command("set_site_domain", "digigadg.ir")
    update.assert_called_once_with(
        pk=settings.SITE_ID, defaults={"domain": "digigadg.ir", "name": "دیجی گج"}
    )
    clear.assert_called_once_with()


def test_site_domain_rejects_other_destination_before_database_access():
    with pytest.raises(CommandError):
        call_command("set_site_domain", "digigadg.com")

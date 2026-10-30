"""Update Django Sites after moving a restored store to a new domain."""

from django.conf import settings
from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Set the canonical Django Site domain without running bootstrap/demo seeds"

    def add_arguments(self, parser):
        parser.add_argument("domain")

    def handle(self, *args, **options):
        domain = options["domain"].strip().lower()
        if domain != "digigadg.ir":
            raise CommandError("This migration targets digigadg.ir")
        Site.objects.update_or_create(
            pk=settings.SITE_ID, defaults={"domain": domain, "name": "دیجی گج"}
        )
        Site.objects.clear_cache()
        self.stdout.write(self.style.SUCCESS(f"Django Site updated: {domain}"))

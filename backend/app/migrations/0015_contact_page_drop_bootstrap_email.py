from django.db import migrations

OLD_CONTACT_EMAIL = "mombeyni.daniel@gmail.com"
NEW_BODY = "از طریق فرم زیر تیکت پشتیبانی ثبت کنید تا تیم ما پاسخ دهد."


def drop_bootstrap_contact_email(apps, schema_editor):
    SitePage = apps.get_model("app", "SitePage")
    page = SitePage.objects.filter(slug="contact").first()
    if not page:
        return
    body = page.body or ""
    if OLD_CONTACT_EMAIL not in body and "از طریق ایمیل" not in body:
        return
    page.body = NEW_BODY
    page.save(update_fields=["body", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0014_email_templates"),
    ]

    operations = [
        migrations.RunPython(drop_bootstrap_contact_email, migrations.RunPython.noop),
    ]

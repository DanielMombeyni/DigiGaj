from django.db import migrations

SUFFIX = "لغو 11"


def append_opt_out(apps, schema_editor):
    SmsTemplate = apps.get_model("app", "SmsTemplate")
    for row in SmsTemplate.objects.filter(mode="text").iterator():
        body = (row.body_text or "").rstrip()
        if not body:
            continue
        compact = body.replace(" ", "").replace("\u200c", "")
        if compact.endswith("لغو11"):
            continue
        row.body_text = f"{body}\n{SUFFIX}"
        row.save(update_fields=["body_text"])


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0023_signup_otp_template"),
    ]

    operations = [
        migrations.RunPython(append_opt_out, migrations.RunPython.noop),
    ]

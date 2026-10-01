from django.db import migrations


def use_otp_body(apps, schema_editor):
    SmsTemplate = apps.get_model("app", "SmsTemplate")
    old = "{name}، لینک بازیابی رمز: {link}"
    new = "{name}، کد بازیابی رمز: {code}"
    SmsTemplate.objects.filter(event="forgot_password", body_text=old).update(body_text=new)


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0021_google_auth_sms_events"),
    ]

    operations = [
        migrations.RunPython(use_otp_body, migrations.RunPython.noop),
    ]

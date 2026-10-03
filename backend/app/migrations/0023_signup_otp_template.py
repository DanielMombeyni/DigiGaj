from django.db import migrations, models


def seed_signup_otp(apps, schema_editor):
    SmsTemplate = apps.get_model("app", "SmsTemplate")
    if SmsTemplate.objects.filter(event="signup_otp", target_user="customer").exists():
        return
    if SmsTemplate.objects.filter(key="signup_otp").exists():
        return
    SmsTemplate.objects.create(
        key="signup_otp",
        name="کد تأیید ثبت‌نام",
        event="signup_otp",
        target_user="customer",
        mode="text",
        body_text="کد تأیید ثبت‌نام شما: {code}",
        param_keys=[],
        sample_params={},
        is_enabled=True,
        sort_order=0,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0022_forgot_password_otp_template"),
    ]

    operations = [
        migrations.AlterField(
            model_name="smstemplate",
            name="event",
            field=models.CharField(
                choices=[
                    ("login_otp", "کد ورود"),
                    ("signup_otp", "کد تأیید ثبت‌نام"),
                    ("forgot_password", "بازیابی رمز"),
                    ("order_status_changed", "تغییر وضعیت سفارش"),
                    ("custom", "سفارشی"),
                ],
                db_index=True,
                default="custom",
                max_length=40,
                verbose_name="رویداد",
            ),
        ),
        migrations.RunPython(seed_signup_otp, migrations.RunPython.noop),
    ]

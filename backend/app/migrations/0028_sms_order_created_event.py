from django.db import migrations, models


def seed_order_created_template(apps, schema_editor):
    SmsTemplate = apps.get_model("app", "SmsTemplate")
    if SmsTemplate.objects.filter(event="order_created", target_user="customer").exists():
        return
    if SmsTemplate.objects.filter(key="order_created").exists():
        return
    SmsTemplate.objects.create(
        key="order_created",
        name="ثبت سفارش",
        event="order_created",
        target_user="customer",
        mode="text",
        body_text=(
            "{name}، سفارش {order_number} با موفقیت ثبت شد. "
            "وضعیت: {status}."
        ),
        param_keys=[],
        sample_params={},
        is_enabled=True,
        sort_order=0,
    )


class Migration(migrations.Migration):
    """
    Add SmsTemplate.Event.ORDER_CREATED choices + optional customer seed.

    Depends on product-priority leaf so the app migration graph stays linear:
    0024 → 0025 (bindings) → 0026 (claims) → 0027 (display_priority) → 0028.
    """

    dependencies = [
        ("app", "0027_product_display_priority"),
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
                    ("order_created", "ثبت سفارش"),
                    ("order_status_changed", "تغییر وضعیت سفارش"),
                    ("order_paid", "پرداخت موفق"),
                    ("order_shipped", "ارسال سفارش"),
                    ("order_delivered", "تحویل سفارش"),
                    ("custom", "سفارشی"),
                ],
                db_index=True,
                default="custom",
                max_length=40,
                verbose_name="رویداد",
            ),
        ),
        migrations.RunPython(seed_order_created_template, migrations.RunPython.noop),
    ]

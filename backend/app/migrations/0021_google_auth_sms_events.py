from django.db import migrations, models
import django.db.models.deletion


def seed_event_templates(apps, schema_editor):
    SmsTemplate = apps.get_model("app", "SmsTemplate")
    rows = [
        (
            "login_otp",
            "کد ورود",
            "login_otp",
            "customer",
            "کد ورود شما: {code}",
        ),
        (
            "forgot_password",
            "بازیابی رمز",
            "forgot_password",
            "customer",
            "{name}، لینک بازیابی رمز: {link}",
        ),
        (
            "order_status_changed",
            "تغییر وضعیت سفارش",
            "order_status_changed",
            "customer",
            "{name}، سفارش {order_id} به وضعیت {status} تغییر کرد.",
        ),
    ]
    for key, name, event, target, body in rows:
        if SmsTemplate.objects.filter(event=event, target_user=target).exists():
            continue
        if SmsTemplate.objects.filter(key=key).exists():
            continue
        SmsTemplate.objects.create(
            key=key,
            name=name,
            event=event,
            target_user=target,
            mode="text",
            body_text=body,
            param_keys=[],
            sample_params={},
            is_enabled=True,
            sort_order=0,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0020_sms_templates_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="google_sub",
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                unique=True,
                verbose_name="شناسه گوگل",
            ),
        ),
        migrations.AlterField(
            model_name="userprofile",
            name="phone",
            field=models.CharField(blank=True, db_index=True, max_length=20),
        ),
        migrations.AddField(
            model_name="smstemplate",
            name="event",
            field=models.CharField(
                choices=[
                    ("login_otp", "کد ورود"),
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
        migrations.AddField(
            model_name="smstemplate",
            name="target_user",
            field=models.CharField(
                choices=[
                    ("customer", "مشتری"),
                    ("admin", "ادمین"),
                    ("all", "همه"),
                ],
                db_index=True,
                default="customer",
                max_length=16,
                verbose_name="مخاطب",
            ),
        ),
        migrations.AddIndex(
            model_name="smstemplate",
            index=models.Index(
                fields=["event", "target_user", "is_enabled"],
                name="app_sms_tpl_evt_tgt_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="smstemplate",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_enabled=True) & ~models.Q(event="custom"),
                fields=("event", "target_user"),
                name="uniq_sms_event_target_enabled",
            ),
        ),
        migrations.CreateModel(
            name="SmsLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="ایجاد")),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="به‌روزرسانی"),
                ),
                ("phone", models.CharField(db_index=True, max_length=20, verbose_name="شماره")),
                ("event", models.CharField(db_index=True, max_length=40, verbose_name="رویداد")),
                (
                    "status",
                    models.CharField(
                        choices=[("sent", "ارسال‌شده"), ("failed", "ناموفق")],
                        db_index=True,
                        max_length=16,
                        verbose_name="وضعیت",
                    ),
                ),
                ("error", models.CharField(blank=True, max_length=500, verbose_name="خطا")),
                (
                    "template",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="logs",
                        to="app.smstemplate",
                    ),
                ),
            ],
            options={
                "verbose_name": "گزارش پیامک",
                "verbose_name_plural": "گزارش پیامک‌ها",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="smslog",
            index=models.Index(fields=["-created_at"], name="app_sms_log_created_idx"),
        ),
        migrations.RunPython(seed_event_templates, migrations.RunPython.noop),
    ]

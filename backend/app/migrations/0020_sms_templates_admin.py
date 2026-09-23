from django.db import migrations, models


def add_sms_page_to_roles(apps, schema_editor):
    StaffRole = apps.get_model("app", "StaffRole")
    for role in StaffRole.objects.all():
        pages = list(role.pages or [])
        if "sms" not in pages and ("dashboard" in pages or "settings" in pages or "emails" in pages):
            pages.append("sms")
            role.pages = pages
            role.save(update_fields=["pages"])


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0019_sms_provider_signal"),
    ]

    operations = [
        migrations.CreateModel(
            name="SmsTemplate",
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
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("key", models.SlugField(max_length=80, unique=True)),
                ("name", models.CharField(max_length=160)),
                (
                    "mode",
                    models.CharField(
                        choices=[("text", "متن آزاد"), ("pattern", "الگوی سیگنال")],
                        db_index=True,
                        default="text",
                        max_length=16,
                    ),
                ),
                (
                    "body_text",
                    models.TextField(
                        blank=True,
                        help_text="متن آزاد؛ از {{متغیر}} برای جایگذاری استفاده کنید",
                    ),
                ),
                (
                    "pattern_id",
                    models.PositiveIntegerField(
                        blank=True,
                        help_text="شناسه الگوی ثبت‌شده در پنل سیگنال",
                        null=True,
                    ),
                ),
                ("param_keys", models.JSONField(blank=True, default=list)),
                ("sample_params", models.JSONField(blank=True, default=dict)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("is_enabled", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
            ],
            options={
                "verbose_name": "قالب پیامک",
                "verbose_name_plural": "قالب‌های پیامک",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="smstemplate",
            index=models.Index(
                fields=["mode", "is_enabled"], name="app_sms_tpl_mode_en_idx"
            ),
        ),
        migrations.RunPython(add_sms_page_to_roles, migrations.RunPython.noop),
    ]

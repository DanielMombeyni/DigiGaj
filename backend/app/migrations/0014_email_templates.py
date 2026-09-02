from django.db import migrations, models


def add_emails_page_and_templates(apps, schema_editor):
    StaffRole = apps.get_model("app", "StaffRole")
    EmailTemplate = apps.get_model("app", "EmailTemplate")
    SiteSetting = apps.get_model("app", "SiteSetting")

    for role in StaffRole.objects.all():
        pages = list(role.pages or [])
        if "emails" not in pages and ("dashboard" in pages or "settings" in pages):
            pages.append("emails")
            role.pages = pages
            role.save(update_fields=["pages"])

    if not SiteSetting.objects.filter(key="email_smtp").exists():
        SiteSetting.objects.create(
            key="email_smtp",
            value={
                "enabled": False,
                "host": "",
                "port": 587,
                "username": "",
                "password": "",
                "use_tls": True,
                "use_ssl": False,
                "from_email": "",
                "from_name": "",
                "timeout": 20,
            },
        )

    wrap = (
        '<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;'
        "max-width:560px;margin:0 auto;padding:24px;color:#1f2937;line-height:1.9;"
        'background:#f8fafc">'
        '<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e5e7eb">'
        "{inner}"
        "</div></div>"
    )
    defaults = [
        (
            "order_created",
            "ثبت سفارش",
            "order_created",
            "سفارش {{order_number}} ثبت شد",
            wrap.format(
                inner=(
                    "<p>سلام {{customer_name}}،</p>"
                    "<p>سفارش شما با شماره <strong>{{order_number}}</strong> ثبت شد.</p>"
                    "<p>اقلام:</p><p>{{order_items}}</p>"
                    "<p>مبلغ کل: <strong>{{order_total}}</strong></p>"
                    "<p>{{store_name}}</p>"
                )
            ),
            10,
        ),
        (
            "order_paid",
            "پرداخت موفق",
            "order_paid",
            "پرداخت سفارش {{order_number}} تأیید شد",
            wrap.format(
                inner=(
                    "<p>سلام {{customer_name}}،</p>"
                    "<p>پرداخت سفارش <strong>{{order_number}}</strong> با موفقیت انجام شد.</p>"
                    "<p>مبلغ: <strong>{{order_total}}</strong></p>"
                    "<p>{{store_name}}</p>"
                )
            ),
            20,
        ),
        (
            "order_status_changed",
            "تغییر وضعیت سفارش",
            "order_status_changed",
            "وضعیت سفارش {{order_number}}: {{order_status}}",
            wrap.format(
                inner=(
                    "<p>سلام {{customer_name}}،</p>"
                    "<p>وضعیت سفارش <strong>{{order_number}}</strong> به‌روز شد.</p>"
                    "<p>از {{previous_status}} به <strong>{{order_status}}</strong>.</p>"
                    "<p>{{store_name}}</p>"
                )
            ),
            30,
        ),
        (
            "ticket_created",
            "ثبت تیکت پشتیبانی",
            "ticket_created",
            "تیکت {{ticket_number}} ثبت شد",
            wrap.format(
                inner=(
                    "<p>سلام {{customer_name}}،</p>"
                    "<p>تیکت پشتیبانی شما با شماره <strong>{{ticket_number}}</strong> ثبت شد.</p>"
                    "<p>موضوع: {{ticket_subject}}</p>"
                    "<p>{{store_name}}</p>"
                )
            ),
            40,
        ),
        (
            "ticket_replied",
            "پاسخ تیکت پشتیبانی",
            "ticket_replied",
            "پاسخ جدید برای تیکت {{ticket_number}}",
            wrap.format(
                inner=(
                    "<p>سلام {{customer_name}}،</p>"
                    "<p>پاسخ جدیدی برای تیکت <strong>{{ticket_number}}</strong> ثبت شد.</p>"
                    "<p>{{ticket_message}}</p>"
                    "<p>{{store_name}}</p>"
                )
            ),
            50,
        ),
        (
            "user_registered",
            "خوش‌آمد ثبت‌نام",
            "user_registered",
            "به {{store_name}} خوش آمدید",
            wrap.format(
                inner=(
                    "<p>سلام {{customer_name}}،</p>"
                    "<p>حساب شما در {{store_name}} ساخته شد.</p>"
                    "<p>{{store_url}}</p>"
                )
            ),
            60,
        ),
    ]
    existing = set(EmailTemplate.objects.filter(is_builtin=True).values_list("key", flat=True))
    EmailTemplate.objects.bulk_create(
        [
            EmailTemplate(
                key=key,
                name=name,
                event=event,
                subject=subject,
                body_html=body,
                is_enabled=True,
                is_builtin=True,
                sort_order=sort_order,
            )
            for key, name, event, subject, body, sort_order in defaults
            if key not in existing
        ]
    )


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0013_product_list_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailTemplate",
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
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="ایجاد"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="به‌روزرسانی"),
                ),
                ("key", models.SlugField(max_length=80, unique=True)),
                ("name", models.CharField(max_length=160)),
                (
                    "event",
                    models.CharField(
                        choices=[
                            ("order_created", "ثبت سفارش"),
                            ("order_paid", "پرداخت موفق"),
                            ("order_status_changed", "تغییر وضعیت سفارش"),
                            ("ticket_created", "ثبت تیکت پشتیبانی"),
                            ("ticket_replied", "پاسخ تیکت"),
                            ("user_registered", "ثبت‌نام مشتری"),
                            ("custom", "سفارشی (فقط ارسال آزمایشی)"),
                        ],
                        db_index=True,
                        max_length=40,
                    ),
                ),
                ("trigger_status", models.CharField(blank=True, max_length=20)),
                ("subject", models.CharField(max_length=255)),
                ("body_html", models.TextField()),
                ("is_enabled", models.BooleanField(default=True)),
                ("is_builtin", models.BooleanField(default=False)),
                ("sort_order", models.PositiveIntegerField(default=0)),
            ],
            options={
                "verbose_name": "قالب ایمیل",
                "verbose_name_plural": "قالب‌های ایمیل",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="emailtemplate",
            index=models.Index(
                fields=["event", "is_enabled"],
                name="app_email_event_enabled_idx",
            ),
        ),
        migrations.RunPython(add_emails_page_and_templates, migrations.RunPython.noop),
    ]

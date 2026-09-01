from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("app", "0004_sms_providers"),
    ]

    operations = [
        migrations.CreateModel(
            name="SupportTicket",
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
                (
                    "ticket_number",
                    models.CharField(db_index=True, max_length=24, unique=True),
                ),
                ("full_name", models.CharField(max_length=180)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("phone", models.CharField(blank=True, max_length=20)),
                ("subject", models.CharField(max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "باز"),
                            ("in_progress", "در حال بررسی"),
                            ("answered", "پاسخ‌داده‌شده"),
                            ("closed", "بسته‌شده"),
                        ],
                        db_index=True,
                        default="open",
                        max_length=20,
                    ),
                ),
                (
                    "priority",
                    models.CharField(
                        choices=[
                            ("low", "کم"),
                            ("normal", "عادی"),
                            ("high", "بالا"),
                        ],
                        default="normal",
                        max_length=10,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="support_tickets",
                        to="auth.user",
                    ),
                ),
            ],
            options={
                "verbose_name": "تیکت پشتیبانی",
                "verbose_name_plural": "تیکت‌های پشتیبانی",
                "ordering": ["-updated_at"],
            },
        ),
        migrations.CreateModel(
            name="TicketMessage",
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
                ("is_staff_reply", models.BooleanField(default=False)),
                ("body", models.TextField()),
                (
                    "author",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ticket_messages",
                        to="auth.user",
                    ),
                ),
                (
                    "ticket",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="app.supportticket",
                    ),
                ),
            ],
            options={
                "verbose_name": "پیام تیکت",
                "verbose_name_plural": "پیام‌های تیکت",
                "ordering": ["created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="supportticket",
            index=models.Index(
                fields=["status", "-updated_at"],
                name="app_support_status_upd_idx",
            ),
        ),
    ]

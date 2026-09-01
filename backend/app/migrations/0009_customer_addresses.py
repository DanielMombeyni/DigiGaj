from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0008_product_rating"),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomerAddress",
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
                ("label", models.CharField(blank=True, max_length=60)),
                ("full_name", models.CharField(max_length=180)),
                ("phone", models.CharField(max_length=20)),
                ("address", models.TextField()),
                ("city", models.CharField(blank=True, max_length=80)),
                ("postal_code", models.CharField(blank=True, max_length=20)),
                ("is_active", models.BooleanField(db_index=True, default=False)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="addresses",
                        to="auth.user",
                    ),
                ),
            ],
            options={
                "verbose_name": "آدرس مشتری",
                "verbose_name_plural": "آدرس‌های مشتری",
                "ordering": ["-is_active", "-updated_at"],
            },
        ),
        migrations.AddIndex(
            model_name="customeraddress",
            index=models.Index(
                fields=["user", "is_active"], name="app_custadd_user_active_idx"
            ),
        ),
    ]

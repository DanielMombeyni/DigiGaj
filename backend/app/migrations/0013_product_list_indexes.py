from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0012_staff_storefront_page"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["is_active", "price_toman"],
                name="app_product_active_price_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["is_active", "-created_at"],
                name="app_product_active_created_idx",
            ),
        ),
    ]

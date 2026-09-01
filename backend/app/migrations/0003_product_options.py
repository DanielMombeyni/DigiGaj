# Generated manually — product colors, sizes, variants, attributes

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0002_remove_cafebazaar"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductAttribute",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="به‌روزرسانی")),
                ("name", models.CharField(max_length=120)),
                ("value", models.CharField(max_length=255)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attributes", to="app.product")),
            ],
            options={
                "verbose_name": "ویژگی محصول",
                "verbose_name_plural": "ویژگی‌های محصول",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="ProductColor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="به‌روزرسانی")),
                ("name", models.CharField(max_length=80)),
                ("hex_code", models.CharField(blank=True, help_text="#RRGGBB", max_length=7)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="colors", to="app.product")),
            ],
            options={
                "verbose_name": "رنگ محصول",
                "verbose_name_plural": "رنگ‌های محصول",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="ProductSize",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="به‌روزرسانی")),
                ("name", models.CharField(max_length=80)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sizes", to="app.product")),
            ],
            options={
                "verbose_name": "سایز محصول",
                "verbose_name_plural": "سایزهای محصول",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="ProductVariant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="به‌روزرسانی")),
                ("price_toman", models.PositiveBigIntegerField(blank=True, help_text="خالی = استفاده از قیمت پایه محصول", null=True, validators=[django.core.validators.MinValueValidator(0)])),
                ("stock", models.PositiveIntegerField(default=0)),
                ("sku", models.CharField(blank=True, max_length=64)),
                ("is_active", models.BooleanField(default=True)),
                ("option_key", models.CharField(db_index=True, max_length=64)),
                ("color", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="variants", to="app.productcolor")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="variants", to="app.product")),
                ("size", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="variants", to="app.productsize")),
            ],
            options={
                "verbose_name": "تنوع محصول",
                "verbose_name_plural": "تنوع‌های محصول",
                "ordering": ["id"],
            },
        ),
        migrations.AddField(
            model_name="orderitem",
            name="variant",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="order_items", to="app.productvariant"),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="variant_label",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="productimage",
            name="color",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="images", to="app.productcolor"),
        ),
        migrations.AlterField(
            model_name="product",
            name="price_toman",
            field=models.PositiveBigIntegerField(validators=[django.core.validators.MinValueValidator(0)], verbose_name="قیمت پایه (تومان)"),
        ),
        migrations.AlterField(
            model_name="product",
            name="stock",
            field=models.PositiveIntegerField(default=0, help_text="موجودی پایه وقتی تنوع رنگ/سایز تعریف نشده"),
        ),
        migrations.AddConstraint(
            model_name="productvariant",
            constraint=models.UniqueConstraint(fields=("product", "option_key"), name="uniq_product_variant_option_key"),
        ),
    ]

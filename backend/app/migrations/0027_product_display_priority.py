from django.core.validators import MaxValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0026_sms_dispatch_claim"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="display_priority",
            field=models.PositiveIntegerField(
                default=0,
                help_text="عدد بزرگ‌تر = بالاتر در ترتیب پیشنهادی فروشگاه؛ ۰ = بدون اولویت اضافی",
                validators=[MaxValueValidator(9999)],
                verbose_name="اولویت نمایش",
            ),
        ),
        migrations.AlterModelOptions(
            name="product",
            options={
                "ordering": ["-display_priority", "-created_at"],
                "verbose_name": "محصول",
                "verbose_name_plural": "محصولات",
            },
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["is_active", "-display_priority", "-created_at"],
                name="app_product_is_acti_prio_idx",
            ),
        ),
    ]

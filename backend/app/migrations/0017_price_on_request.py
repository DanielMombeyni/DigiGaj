from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0016_category_delete_set_null"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="price_on_request",
            field=models.BooleanField(
                default=False,
                help_text="اگر فعال باشد قیمت ثابت ندارد و باید با فروشگاه تماس گرفته شود",
                verbose_name="قیمت با تماس",
            ),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="price_pending",
            field=models.BooleanField(
                default=False,
                help_text="آیتم بدون قیمت ثابت؛ تا اعلام قیمت توسط ادمین قابل پرداخت نیست",
                verbose_name="در انتظار قیمت",
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("awaiting_price", "در انتظار اعلام قیمت"),
                    ("pending", "در انتظار پرداخت"),
                    ("paid", "پرداخت‌شده"),
                    ("processing", "در حال آماده‌سازی"),
                    ("shipped", "ارسال‌شده"),
                    ("delivered", "تحویل‌شده"),
                    ("cancelled", "لغو‌شده"),
                    ("refunded", "مسترد"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]

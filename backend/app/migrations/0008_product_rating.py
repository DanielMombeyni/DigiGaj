from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0007_customers_optional_address"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="rating",
            field=models.DecimalField(
                decimal_places=1,
                default=0,
                help_text="۰ تا ۵ ستاره",
                max_digits=2,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(5),
                ],
                verbose_name="امتیاز",
            ),
        ),
    ]

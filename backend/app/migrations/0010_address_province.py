from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0009_customer_addresses"),
    ]

    operations = [
        migrations.AddField(
            model_name="customeraddress",
            name="province",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="order",
            name="province",
            field=models.CharField(blank=True, max_length=80),
        ),
    ]

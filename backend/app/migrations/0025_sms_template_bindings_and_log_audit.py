from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("app", "0024_sms_opt_out_suffix"),
    ]

    operations = [
        migrations.AddField(
            model_name="smstemplate",
            name="param_bindings",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="smstemplate",
            name="event",
            field=models.CharField(
                choices=[
                    ("login_otp", "کد ورود"),
                    ("signup_otp", "کد تأیید ثبت‌نام"),
                    ("forgot_password", "بازیابی رمز"),
                    ("order_status_changed", "تغییر وضعیت سفارش"),
                    ("order_paid", "پرداخت موفق"),
                    ("order_shipped", "ارسال سفارش"),
                    ("order_delivered", "تحویل سفارش"),
                    ("custom", "سفارشی"),
                ],
                db_index=True,
                default="custom",
                max_length=40,
                verbose_name="رویداد",
            ),
        ),
        migrations.AddField(
            model_name="smslog",
            name="actor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sms_logs",
                to=settings.AUTH_USER_MODEL,
                verbose_name="ادمین ارسال‌کننده",
            ),
        ),
        migrations.AddField(
            model_name="smslog",
            name="batch_id",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name="smslog",
            name="fallback_reason",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="smslog",
            name="recipient_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="received_sms_logs",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="smslog",
            name="status",
            field=models.CharField(
                choices=[
                    ("sent", "ارسال‌شده"),
                    ("failed", "ناموفق"),
                    ("queued", "در صف"),
                ],
                db_index=True,
                max_length=16,
                verbose_name="وضعیت",
            ),
        ),
        migrations.AddIndex(
            model_name="smslog",
            index=models.Index(
                fields=["batch_id", "-created_at"], name="app_sms_log_batch_idx"
            ),
        ),
    ]

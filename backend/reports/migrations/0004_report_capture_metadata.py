from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0003_alter_report_nlp_meta'),
    ]

    operations = [
        migrations.AddField(
            model_name='report',
            name='capture_source',
            field=models.CharField(
                choices=[('CAMERA', 'دوربین درون‌برنامه‌ای'), ('UNKNOWN', 'نامشخص')],
                default='UNKNOWN',
                help_text='آیا تصویر مستقیماً با دوربین درون‌برنامه ثبت شده یا منبع آن نامشخص است.',
                max_length=12,
                verbose_name='منبع تصویر',
            ),
        ),
        migrations.AddField(
            model_name='report',
            name='captured_at',
            field=models.DateTimeField(
                blank=True,
                help_text='برچسب زمانی لحظهٔ ثبت تصویر روی دستگاه کاربر.',
                null=True,
                verbose_name='زمان ثبت در دستگاه',
            ),
        ),
        migrations.AddField(
            model_name='report',
            name='gps_accuracy',
            field=models.FloatField(
                blank=True,
                help_text='شعاع خطای GPS گزارش‌شده توسط دستگاه، بر حسب متر.',
                null=True,
                verbose_name='دقت موقعیت (متر)',
            ),
        ),
        migrations.AddField(
            model_name='report',
            name='client_integrity_hash',
            field=models.CharField(
                blank=True,
                default='',
                help_text='هش SHA-256 بستهٔ تصویر+مختصات+زمان که سمت کلاینت محاسبه شده است.',
                max_length=64,
                verbose_name='اثر انگشت یکپارچگی',
            ),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0025_payment_timeout'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='ready_no_driver_escalated',
            field=models.BooleanField(default=False),
        ),
    ]

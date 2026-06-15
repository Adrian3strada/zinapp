from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_shipment_size'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='driver_nearby_notified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='shipment',
            name='driver_nearby_notified',
            field=models.BooleanField(default=False),
        ),
    ]

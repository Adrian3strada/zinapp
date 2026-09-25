from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0019_shipment_mandado'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='delivery_fee',
            field=models.DecimalField(decimal_places=2, default=Decimal('35.00'), max_digits=10),
        ),
    ]

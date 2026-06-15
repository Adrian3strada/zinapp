from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_shipment'),
    ]

    operations = [
        migrations.AddField(
            model_name='shipment',
            name='size',
            field=models.CharField(
                choices=[
                    ('small', 'Chico'),
                    ('medium', 'Mediano'),
                    ('large', 'Grande'),
                ],
                default='small',
                max_length=10,
            ),
        ),
    ]

# Generated manually for POS phase 3

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0017_pos_phase0_phase1'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='cancellation_source',
            field=models.CharField(
                blank=True,
                choices=[
                    ('restaurant_reject', 'Rechazo restaurante'),
                    ('customer', 'Cliente'),
                    ('pos', 'Cancelación POS'),
                ],
                default='',
                max_length=20,
            ),
        ),
    ]

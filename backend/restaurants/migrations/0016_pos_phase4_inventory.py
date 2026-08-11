# Manual migration: optional POS inventory fields on Product

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0015_pos_phase0_phase1'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='track_inventory',
            field=models.BooleanField(
                default=False,
                help_text='Si True, el POS descuenta stock al vender y bloquea sin existencia.',
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='stock_quantity',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Existencia actual cuando track_inventory está activo.',
            ),
        ),
    ]

from datetime import timedelta

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0014_product_options_and_order_item_snapshot'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='prep_minutes',
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text='Minutos de preparación estimados al aceptar el pedido.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='estimated_ready_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Hora estimada en que el pedido estará listo.',
                null=True,
            ),
        ),
    ]

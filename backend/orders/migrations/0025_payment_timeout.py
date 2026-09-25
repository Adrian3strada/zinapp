from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0024_kitchen_stale_reminder'),
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
                    ('payment_timeout', 'Pago no recibido'),
                ],
                default='',
                max_length=20,
            ),
        ),
    ]

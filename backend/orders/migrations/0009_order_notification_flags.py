from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0008_idempotencyrecord'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='cancellation_source',
            field=models.CharField(
                blank=True,
                choices=[
                    ('restaurant_reject', 'Rechazo restaurante'),
                    ('customer', 'Cliente'),
                ],
                default='',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='pending_reminder_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='order',
            name='ready_no_driver_reminder_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='order',
            name='review_reminder_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='shipment',
            name='pending_reminder_sent',
            field=models.BooleanField(default=False),
        ),
    ]

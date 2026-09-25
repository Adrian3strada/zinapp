from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0023_transfer_proof_driver_stale'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='kitchen_stale_reminder_sent',
            field=models.BooleanField(default=False),
        ),
    ]

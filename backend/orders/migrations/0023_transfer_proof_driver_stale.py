from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0022_rewards_benefits'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='driver_stale_reminder_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_proof',
            field=models.ImageField(blank=True, help_text='Comprobante de transferencia subido por el cliente.', null=True, upload_to='payment_proofs/'),
        ),
        migrations.AddField(
            model_name='order',
            name='transfer_confirmed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='shipment',
            name='driver_stale_reminder_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='order',
            name='applied_benefit',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Beneficio de envío aplicado: birthday | loyalty | referral_invitee | referral_credit.',
                max_length=20,
            ),
        ),
    ]

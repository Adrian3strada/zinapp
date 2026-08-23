from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0018_pos_phase3_cancel_corte'),
    ]

    operations = [
        migrations.AddField(
            model_name='shipment',
            name='kind',
            field=models.CharField(
                choices=[('courier', 'Envío'), ('mandado', 'Mandado')],
                default='courier',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='shipment',
            name='mandado_details',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

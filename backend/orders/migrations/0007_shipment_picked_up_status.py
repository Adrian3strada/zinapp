from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_driver_nearby_notified'),
    ]

    operations = [
        migrations.AlterField(
            model_name='shipment',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pendiente'),
                    ('picked_up', 'Recogido'),
                    ('on_the_way', 'En camino'),
                    ('delivered', 'Entregado'),
                    ('cancelled', 'Cancelado'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]

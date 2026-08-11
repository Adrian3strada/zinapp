# Generated manually for POS phase 3

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0001_pos_phase0_phase1'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='cashmovement',
            constraint=models.UniqueConstraint(
                condition=models.Q(('order__isnull', False), ('type', 'cancellation')),
                fields=('session', 'order', 'type'),
                name='pos_unique_cancellation_movement_per_order_session',
            ),
        ),
    ]

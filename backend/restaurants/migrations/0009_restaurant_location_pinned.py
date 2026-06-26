from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0008_restaurant_inactive_defaults'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='location_pinned',
            field=models.BooleanField(
                default=False,
                help_text='True cuando el dueño confirmó la ubicación exacta en el mapa.',
            ),
        ),
    ]

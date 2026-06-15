from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0002_restaurant_accepting_orders'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='category',
            field=models.CharField(
                choices=[
                    ('general', 'General'),
                    ('pizzas', 'Pizzas'),
                    ('makis', 'Makis'),
                    ('mexicana', 'Mexicana'),
                ],
                default='general',
                max_length=20,
            ),
        ),
    ]

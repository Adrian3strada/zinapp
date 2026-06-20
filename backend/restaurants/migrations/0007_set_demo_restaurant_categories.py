from django.db import migrations

DEMO_CATEGORIES = {
    'Pizzas & Beer': 'pizzas',
    'Shukrani Makis': 'makis',
    'Restaurante Jardines': 'mexicana',
}


def set_demo_categories(apps, schema_editor):
    Restaurant = apps.get_model('restaurants', 'Restaurant')
    for name, category in DEMO_CATEGORIES.items():
        Restaurant.objects.filter(name=name).update(category=category)


class Migration(migrations.Migration):
    dependencies = [
        ('restaurants', '0006_alter_restaurant_whatsapp'),
    ]

    operations = [
        migrations.RunPython(set_demo_categories, migrations.RunPython.noop),
    ]

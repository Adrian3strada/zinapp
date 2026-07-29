from django.db import migrations, models
import django.db.models.deletion


def copy_legacy_hours(apps, schema_editor):
    Restaurant = apps.get_model('restaurants', 'Restaurant')
    RestaurantBusinessHour = apps.get_model('restaurants', 'RestaurantBusinessHour')
    rows = []
    for restaurant in Restaurant.objects.exclude(opening_time__isnull=True).exclude(closing_time__isnull=True):
        rows.extend(
            RestaurantBusinessHour(
                restaurant_id=restaurant.id,
                day_of_week=day,
                is_closed=False,
                opening_time=restaurant.opening_time,
                closing_time=restaurant.closing_time,
            )
            for day in range(7)
        )
    RestaurantBusinessHour.objects.bulk_create(rows, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0013_product_category'),
    ]

    operations = [
        migrations.CreateModel(
            name='RestaurantBusinessHour',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('day_of_week', models.PositiveSmallIntegerField(choices=[(0, 'Lunes'), (1, 'Martes'), (2, 'Miércoles'), (3, 'Jueves'), (4, 'Viernes'), (5, 'Sábado'), (6, 'Domingo')])),
                ('is_closed', models.BooleanField(default=False)),
                ('opening_time', models.TimeField(blank=True, null=True)),
                ('closing_time', models.TimeField(blank=True, null=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='business_hours', to='restaurants.restaurant')),
            ],
            options={
                'verbose_name': 'Horario de restaurante',
                'verbose_name_plural': 'Horarios de restaurante',
                'ordering': ['day_of_week'],
            },
        ),
        migrations.AddConstraint(
            model_name='restaurantbusinesshour',
            constraint=models.UniqueConstraint(fields=('restaurant', 'day_of_week'), name='unique_restaurant_business_hour_day'),
        ),
        migrations.RunPython(copy_legacy_hours, migrations.RunPython.noop),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('restaurants', '0004_restaurant_payment_info'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='last_open_notification_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='RestaurantFavorite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='favorites', to='restaurants.restaurant')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='restaurant_favorites', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Restaurante favorito',
                'verbose_name_plural': 'Restaurantes favoritos',
            },
        ),
        migrations.AddConstraint(
            model_name='restaurantfavorite',
            constraint=models.UniqueConstraint(fields=('user', 'restaurant'), name='unique_restaurant_favorite'),
        ),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('restaurants', '0017_expand_restaurant_categories'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductFavorite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='favorites', to='restaurants.product')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='product_favorites', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Producto favorito',
                'verbose_name_plural': 'Productos favoritos',
            },
        ),
        migrations.AddConstraint(
            model_name='productfavorite',
            constraint=models.UniqueConstraint(fields=('user', 'product'), name='unique_product_favorite'),
        ),
    ]

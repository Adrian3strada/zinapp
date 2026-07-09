from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0009_restaurant_location_pinned'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductPromotion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('promo_type', models.CharField(
                    choices=[
                        ('two_for_one', '2x1'),
                        ('percent_off', 'Porcentaje de descuento'),
                        ('special_price', 'Precio especial'),
                    ],
                    max_length=20,
                )),
                ('percent_off', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('special_price', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('label', models.CharField(blank=True, max_length=40)),
                ('valid_until', models.DateTimeField()),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('product', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='promotions',
                    to='restaurants.product',
                )),
                ('restaurant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='promotions',
                    to='restaurants.restaurant',
                )),
            ],
            options={
                'verbose_name': 'Promoción',
                'verbose_name_plural': 'Promociones',
                'ordering': ['-valid_until', '-id'],
            },
        ),
    ]

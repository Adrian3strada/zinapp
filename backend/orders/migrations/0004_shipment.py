from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('orders', '0003_coupon_order_discount_amount_order_payment_status_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Shipment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pendiente'),
                        ('on_the_way', 'En camino'),
                        ('delivered', 'Entregado'),
                        ('cancelled', 'Cancelado'),
                    ],
                    default='pending',
                    max_length=20,
                )),
                ('description', models.CharField(max_length=200)),
                ('pickup_address', models.TextField()),
                ('pickup_latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('pickup_longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('pickup_notes', models.TextField(blank=True)),
                ('delivery_address', models.TextField()),
                ('delivery_latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('delivery_longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('delivery_notes', models.TextField(blank=True)),
                ('payment_method', models.CharField(
                    choices=[('cash', 'Efectivo'), ('transfer', 'Transferencia'), ('online', 'Pago en línea')],
                    default='cash',
                    max_length=20,
                )),
                ('payment_status', models.CharField(
                    choices=[('pending', 'Pendiente'), ('paid', 'Pagado'), ('failed', 'Fallido')],
                    default='pending',
                    max_length=20,
                )),
                ('delivery_fee', models.DecimalField(decimal_places=2, default=Decimal('25.00'), max_digits=10)),
                ('total', models.DecimalField(decimal_places=2, default=Decimal('25.00'), max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('customer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='shipments',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('driver', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='shipment_deliveries',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Envío',
                'verbose_name_plural': 'Envíos',
                'ordering': ['-created_at'],
            },
        ),
    ]

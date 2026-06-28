from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0011_order_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='scheduled_for',
            field=models.DateTimeField(
                blank=True,
                help_text='Entrega programada (opcional).',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='tip_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Propina para el repartidor.',
                max_digits=10,
            ),
        ),
        migrations.CreateModel(
            name='OrderMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('body', models.TextField(max_length=1000)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='messages', to='orders.order')),
                ('sender', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='order_messages', to='accounts.user')),
            ],
            options={
                'verbose_name': 'Mensaje de pedido',
                'verbose_name_plural': 'Mensajes de pedido',
                'ordering': ['created_at'],
            },
        ),
        migrations.CreateModel(
            name='OrderDispute',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.TextField(max_length=2000)),
                ('requested_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pendiente'),
                        ('approved', 'Aprobada'),
                        ('rejected', 'Rechazada'),
                        ('refunded', 'Reembolsada'),
                    ],
                    default='pending',
                    max_length=20,
                )),
                ('admin_notes', models.TextField(blank=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='order_disputes', to='accounts.user')),
                ('order', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='disputes', to='orders.order')),
            ],
            options={
                'verbose_name': 'Disputa / reembolso',
                'verbose_name_plural': 'Disputas / reembolsos',
                'ordering': ['-created_at'],
            },
        ),
    ]

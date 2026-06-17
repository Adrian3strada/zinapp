# Generated manually for idempotency support

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('orders', '0007_shipment_picked_up_status'),
    ]

    operations = [
        migrations.CreateModel(
            name='IdempotencyRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=64)),
                ('scope', models.CharField(max_length=32)),
                ('status', models.CharField(
                    choices=[('pending', 'Pendiente'), ('completed', 'Completado')],
                    default='pending',
                    max_length=16,
                )),
                ('response_body', models.JSONField(blank=True, default=dict)),
                ('status_code', models.PositiveSmallIntegerField(default=201)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='idempotency_records',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Idempotencia',
                'verbose_name_plural': 'Idempotencia',
            },
        ),
        migrations.AddIndex(
            model_name='idempotencyrecord',
            index=models.Index(fields=['created_at'], name='orders_idem_created_idx'),
        ),
        migrations.AddConstraint(
            model_name='idempotencyrecord',
            constraint=models.UniqueConstraint(
                fields=('key', 'user', 'scope'),
                name='orders_idempotency_unique',
            ),
        ),
    ]

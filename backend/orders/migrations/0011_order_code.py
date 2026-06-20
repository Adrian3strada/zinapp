from django.db import migrations, models

from orders.codes import generate_order_code


def backfill_order_codes(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    used = set(Order.objects.exclude(code='').values_list('code', flat=True))

    for order in Order.objects.filter(code='').iterator():
        for _ in range(32):
            code = generate_order_code()
            if code in used:
                continue
            order.code = code
            order.save(update_fields=['code'])
            used.add(code)
            break


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0010_rename_orders_idem_created_idx_orders_idem_created_6691b9_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='code',
            field=models.CharField(
                blank=True,
                default='',
                max_length=8,
                verbose_name='Código',
            ),
        ),
        migrations.RunPython(backfill_order_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='order',
            name='code',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                max_length=8,
                unique=True,
                verbose_name='Código',
            ),
        ),
    ]

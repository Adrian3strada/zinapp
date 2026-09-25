from django.db import migrations


def backfill_loyalty(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    LoyaltyProgressEvent = apps.get_model('rewards', 'LoyaltyProgressEvent')
    existing = set(
        LoyaltyProgressEvent.objects.values_list('order_id', flat=True)
    )
    rows = []
    qs = (
        Order.objects.filter(
            status='delivered',
            source='zinapp',
            customer_id__isnull=False,
        )
        .exclude(applied_benefit='loyalty')
        .only('id', 'customer_id')
        .iterator()
    )
    for order in qs:
        if order.id in existing:
            continue
        rows.append(
            LoyaltyProgressEvent(user_id=order.customer_id, order_id=order.id)
        )
        if len(rows) >= 500:
            LoyaltyProgressEvent.objects.bulk_create(rows, ignore_conflicts=True)
            rows = []
    if rows:
        LoyaltyProgressEvent.objects.bulk_create(rows, ignore_conflicts=True)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('rewards', '0001_rewards_benefits'),
    ]

    operations = [
        migrations.RunPython(backfill_loyalty, noop),
    ]

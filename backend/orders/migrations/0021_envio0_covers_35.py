from decimal import Decimal

from django.db import migrations


def bump_envio0(apps, schema_editor):
    Coupon = apps.get_model('orders', 'Coupon')
    Coupon.objects.filter(code__iexact='ENVIO0', discount_fixed=Decimal('25.00')).update(
        discount_fixed=Decimal('35.00'),
    )


def revert_envio0(apps, schema_editor):
    Coupon = apps.get_model('orders', 'Coupon')
    Coupon.objects.filter(code__iexact='ENVIO0', discount_fixed=Decimal('35.00')).update(
        discount_fixed=Decimal('25.00'),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0020_food_delivery_fee_35'),
    ]

    operations = [
        migrations.RunPython(bump_envio0, revert_envio0),
    ]

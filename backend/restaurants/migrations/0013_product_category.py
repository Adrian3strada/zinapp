# Generated manually for product menu categories

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0012_product_options_and_order_item_snapshot'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='category',
            field=models.CharField(
                choices=[
                    ('entradas', 'Entradas'),
                    ('comida', 'Comida'),
                    ('bebidas', 'Bebidas'),
                    ('postres', 'Postres'),
                    ('extras', 'Extras'),
                ],
                default='comida',
                help_text='Sección del menú (comida, bebidas, postres, etc.).',
                max_length=20,
            ),
        ),
    ]

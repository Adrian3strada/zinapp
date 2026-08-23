from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0016_pos_phase4_inventory'),
    ]

    operations = [
        migrations.AlterField(
            model_name='restaurant',
            name='category',
            field=models.CharField(
                choices=[
                    ('general', 'General'),
                    ('mexicana', 'Mexicana'),
                    ('tacos', 'Tacos'),
                    ('antojitos', 'Antojitos'),
                    ('pizzas', 'Pizzas'),
                    ('hamburguesas', 'Hamburguesas'),
                    ('pollos', 'Pollos'),
                    ('mariscos', 'Mariscos'),
                    ('carnes', 'Carnes y parrilla'),
                    ('makis', 'Makis y sushi'),
                    ('asiatica', 'Asiática'),
                    ('italiana', 'Italiana'),
                    ('tortas', 'Tortas'),
                    ('desayunos', 'Desayunos'),
                    ('fondas', 'Fondas'),
                    ('postres', 'Postres'),
                    ('cafe', 'Café'),
                    ('bebidas', 'Bebidas y jugos'),
                    ('vinateria', 'Vinatería'),
                    ('saludable', 'Saludable'),
                    ('alitas', 'Alitas'),
                    ('comida_rapida', 'Comida rápida'),
                ],
                default='general',
                max_length=20,
            ),
        ),
    ]

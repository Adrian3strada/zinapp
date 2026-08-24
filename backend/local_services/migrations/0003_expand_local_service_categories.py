from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('local_services', '0002_localservice_address_localservice_category_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='localservice',
            name='category',
            field=models.CharField(
                choices=[
                    ('beauty', 'Belleza'),
                    ('auto', 'Mecánicos'),
                    ('construction', 'Albañilería'),
                    ('plumbing', 'Plomería'),
                    ('electrical', 'Electricista'),
                    ('home', 'Hogar'),
                    ('garden', 'Jardinería'),
                    ('tech', 'Tecnología'),
                    ('pets', 'Mascotas'),
                    ('health', 'Salud'),
                    ('food', 'Alimentos'),
                    ('laundry', 'Lavandería'),
                    ('education', 'Clases'),
                    ('other', 'Otros'),
                ],
                default='other',
                max_length=20,
            ),
        ),
    ]

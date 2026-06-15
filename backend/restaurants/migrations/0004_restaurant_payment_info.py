from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0003_restaurant_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='whatsapp',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='bank_name',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='account_holder',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='clabe',
            field=models.CharField(blank=True, max_length=18),
        ),
    ]

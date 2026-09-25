import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0023_transfer_proof_driver_stale'),
        ('rewards', '0002_backfill_loyalty'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='rewardredemption',
            name='kind',
            field=models.CharField(
                choices=[
                    ('birthday', 'Cumpleaños'),
                    ('loyalty', 'Lealtad'),
                    ('referral_invitee', 'Bienvenida referido'),
                    ('referral_credit', 'Crédito por referido'),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
        migrations.AddConstraint(
            model_name='rewardredemption',
            constraint=models.UniqueConstraint(
                condition=models.Q(('kind', 'referral_invitee'), ('status__in', ['reserved', 'consumed'])),
                fields=('user', 'kind'),
                name='uniq_active_referral_invitee',
            ),
        ),
        migrations.CreateModel(
            name='ReferralCredit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('unused', 'Disponible'), ('reserved', 'Reservado'), ('consumed', 'Utilizado')], db_index=True, default='unused', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('from_user', models.OneToOneField(help_text='Invitado cuya primera entrega genera el crédito.', on_delete=django.db.models.deletion.CASCADE, related_name='referral_credit_granted', to=settings.AUTH_USER_MODEL)),
                ('order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='referral_credits', to='orders.order')),
                ('user', models.ForeignKey(help_text='Quien invitó y recibe el envío gratis.', on_delete=django.db.models.deletion.CASCADE, related_name='referral_credits', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Crédito de referido',
                'verbose_name_plural': 'Créditos de referido',
                'ordering': ['created_at'],
            },
        ),
    ]

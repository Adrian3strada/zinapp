import secrets

from django.db import migrations, models
import django.db.models.deletion

ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _code():
    return ''.join(secrets.choice(ALPHABET) for _ in range(6))


def backfill_referral_codes(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    used = set(User.objects.exclude(referral_code='').values_list('referral_code', flat=True))
    for user in User.objects.filter(referral_code='').iterator():
        for _ in range(40):
            code = _code()
            if code not in used:
                used.add(code)
                user.referral_code = code
                user.save(update_fields=['referral_code'])
                break


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_rewards_benefits'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='referral_code',
            field=models.CharField(blank=True, default='', help_text='Código para invitar amigos (envío gratis para ambos).', max_length=12),
        ),
        migrations.AddField(
            model_name='user',
            name='referred_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Cliente que invitó a esta cuenta.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='referrals',
                to='accounts.user',
            ),
        ),
        migrations.RunPython(backfill_referral_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='user',
            name='referral_code',
            field=models.CharField(blank=True, help_text='Código para invitar amigos (envío gratis para ambos).', max_length=12, unique=True),
        ),
    ]

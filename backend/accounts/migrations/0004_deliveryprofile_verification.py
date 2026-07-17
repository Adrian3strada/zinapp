from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def mark_existing_drivers_pending(apps, schema_editor):
    DeliveryProfile = apps.get_model('accounts', 'DeliveryProfile')
    DeliveryProfile.objects.update(verification_status='pending', is_available=False)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0003_user_avatar'),
    ]

    operations = [
        migrations.AddField(
            model_name='deliveryprofile',
            name='identity_document',
            field=models.ImageField(blank=True, null=True, upload_to='driver_documents/'),
        ),
        migrations.AddField(
            model_name='deliveryprofile',
            name='review_notes',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='deliveryprofile',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='deliveryprofile',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviewed_delivery_profiles',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='deliveryprofile',
            name='verification_status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pendiente'),
                    ('approved', 'Aprobado'),
                    ('rejected', 'Rechazado'),
                ],
                default='pending',
                max_length=12,
            ),
        ),
        migrations.RunPython(mark_existing_drivers_pending, migrations.RunPython.noop),
    ]

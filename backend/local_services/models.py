from django.db import models


class LocalService(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='local_services/', blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(
        max_length=20,
        blank=True,
        help_text='WhatsApp de contacto (opcional; si vacío, usa teléfono).',
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Servicio local'
        verbose_name_plural = 'Servicios locales'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    @property
    def contact_phone(self) -> str:
        return (self.whatsapp or self.phone or '').strip()

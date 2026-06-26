from django.db import models


class LocalServiceCategory(models.TextChoices):
    BEAUTY = 'beauty', 'Belleza'
    HOME = 'home', 'Hogar'
    AUTO = 'auto', 'Automotriz'
    HEALTH = 'health', 'Salud'
    FOOD = 'food', 'Alimentos'
    OTHER = 'other', 'Otros'


class LocalService(models.Model):
    name = models.CharField(max_length=150)
    category = models.CharField(
        max_length=20,
        choices=LocalServiceCategory.choices,
        default=LocalServiceCategory.OTHER,
    )
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='local_services/', blank=True, null=True)
    address = models.TextField(blank=True)
    schedule = models.CharField(
        max_length=120,
        blank=True,
        help_text='Horario visible en la app (ej. Lun–Sáb 10:00–19:00).',
    )
    phone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(
        max_length=20,
        blank=True,
        help_text='WhatsApp de contacto (opcional; si vacío, usa teléfono).',
    )
    instagram = models.CharField(
        max_length=120,
        blank=True,
        help_text='Usuario o enlace de Instagram (ej. @salonmaria).',
    )
    facebook = models.CharField(
        max_length=200,
        blank=True,
        help_text='Enlace o nombre de página de Facebook.',
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

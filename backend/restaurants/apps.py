from django.apps import AppConfig


class RestaurantsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'restaurants'
    verbose_name = 'Restaurantes'

    def ready(self):
        from . import signals  # noqa: F401

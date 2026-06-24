from django.apps import AppConfig


class DashboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard'
    verbose_name = 'Panel ZinApp'

    def ready(self):
        import dashboard.model_admins  # noqa: F401

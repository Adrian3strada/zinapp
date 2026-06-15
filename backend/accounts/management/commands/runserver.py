from django.contrib.staticfiles.management.commands.runserver import (
    Command as StaticfilesRunserverCommand,
)


class Command(StaticfilesRunserverCommand):
    """runserver accesible desde el celular (0.0.0.0) en desarrollo."""

    default_addr = '0.0.0.0'

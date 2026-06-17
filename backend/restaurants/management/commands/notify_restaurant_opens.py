from django.core.management.base import BaseCommand

from restaurants.models import Restaurant
from restaurants.open_notify import notify_restaurant_opened_if_needed


class Command(BaseCommand):
    help = 'Notifica a clientes cuando un restaurante favorito abre por horario'

    def handle(self, *args, **options):
        sent = 0
        for restaurant in Restaurant.objects.filter(is_active=True, accepting_orders=True):
            if notify_restaurant_opened_if_needed(restaurant, manual=False):
                sent += 1
                self.stdout.write(f'Aviso enviado: {restaurant.name}')
        self.stdout.write(self.style.SUCCESS(f'Notificaciones de apertura: {sent}'))

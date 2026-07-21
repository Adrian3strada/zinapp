"""Crea cuentas dedicadas para App Store / Play Review (no bloqueadas por DEMO_ACCOUNTS)."""

from datetime import time
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import DeliveryProfile, User, UserRole
from restaurants.models import Product, Restaurant, RestaurantCategory

# Nombres fuera de DEMO_USERNAMES para que funcionen con DEMO_ACCOUNTS_ENABLED=false
REVIEW_PASSWORD = 'ReviewZinApp2026!'
CUSTOMER_USERNAME = 'apple_review_cliente'
RESTAURANT_USERNAME = 'apple_review_rest'
DRIVER_USERNAME = 'apple_review_driver'
RESTAURANT_NAME = 'ZinApp Review Kitchen'


class Command(BaseCommand):
    help = 'Crea/actualiza cuentas de App Review (cliente, restaurante, repartidor)'

    @transaction.atomic
    def handle(self, *args, **options):
        customer = self._upsert_user(
            CUSTOMER_USERNAME,
            UserRole.CUSTOMER,
            first_name='Apple',
            last_name='Reviewer',
            email='apple-review-cliente@zinapp.test',
            phone='4431000001',
            address='Av. Melchor Ocampo 30, Centro, 58930 Zinapécuaro de Figueroa, Mich.',
        )
        owner = self._upsert_user(
            RESTAURANT_USERNAME,
            UserRole.RESTAURANT,
            first_name='Review',
            last_name='Restaurant',
            email='apple-review-rest@zinapp.test',
            phone='4431000002',
            address='Av. Hidalgo 64-A, Centro, Zinapécuaro de Figueroa, Mich.',
        )
        driver = self._upsert_user(
            DRIVER_USERNAME,
            UserRole.DRIVER,
            first_name='Review',
            last_name='Driver',
            email='apple-review-driver@zinapp.test',
            phone='4431000003',
            address='Col. Félix Ireta, Zinapécuaro de Figueroa, Mich.',
        )

        restaurant, _ = Restaurant.objects.update_or_create(
            owner=owner,
            name=RESTAURANT_NAME,
            defaults={
                'category': RestaurantCategory.GENERAL,
                'description': 'Demo restaurant for App Store review. Always open.',
                'address': 'Av. Hidalgo 64-A, Centro, 58930 Zinapécuaro de Figueroa, Mich.',
                'phone': '4431000002',
                'whatsapp': '4431000002',
                'latitude': Decimal('19.860273'),
                'longitude': Decimal('-100.828562'),
                'location_pinned': True,
                'is_active': True,
                'accepting_orders': True,
                'opening_time': time(0, 0),
                'closing_time': time(23, 59),
            },
        )

        products = [
            ('Burger review', 'Demo burger for reviewers', '89.00'),
            ('Fries review', 'Demo side', '45.00'),
            ('Soda review', 'Demo drink', '25.00'),
        ]
        for name, description, price in products:
            Product.objects.update_or_create(
                restaurant=restaurant,
                name=name,
                defaults={
                    'description': description,
                    'price': Decimal(price),
                    'is_available': True,
                },
            )

        DeliveryProfile.objects.update_or_create(
            user=driver,
            defaults={
                'vehicle_type': DeliveryProfile.VehicleType.MOTORCYCLE,
                'license_plate': 'REV-2026',
                'is_available': True,
                'current_latitude': Decimal('19.860500'),
                'current_longitude': Decimal('-100.830000'),
            },
        )

        self.stdout.write(self.style.SUCCESS('App Review accounts ready.'))
        self.stdout.write('')
        self.stdout.write(f'Password (all): {REVIEW_PASSWORD}')
        self.stdout.write(f'Customer:   {customer.username}')
        self.stdout.write(f'Restaurant: {owner.username}  ({restaurant.name}, active)')
        self.stdout.write(f'Driver:     {driver.username}')

    def _upsert_user(self, username, role, **extra) -> User:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'role': role, 'is_active': True, **extra},
        )
        for key, value in extra.items():
            setattr(user, key, value)
        user.role = role
        user.is_active = True
        user.set_password(REVIEW_PASSWORD)
        user.save()
        label = 'Created' if created else 'Updated'
        self.stdout.write(f'  {label}: {username} ({role})')
        return user

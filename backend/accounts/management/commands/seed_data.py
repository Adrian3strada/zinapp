from datetime import time
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import DeliveryProfile, User, UserRole
from orders.models import Coupon
from restaurants.models import Product, Restaurant

DEFAULT_PASSWORD = 'test1234'

# Restaurantes reales en Zinapécuaro de Figueroa (coords verificadas con OpenStreetMap)
RESTAURANTS = [
    {
        'owner_username': 'rest_pizzas',
        'owner': {
            'first_name': 'Roberto',
            'last_name': 'Sánchez',
            'email': 'pizzas@zinapp.test',
            'phone': '4431112233',
        },
        'restaurant': {
            'name': 'Pizzas & Beer',
            'description': 'Pizzas, boneless y cerveza. Av. Hidalgo, centro de Zinapécuaro.',
            'address': 'Av. Hidalgo 64-A, Los Pocitos, Centro, 58930 Zinapécuaro de Figueroa, Mich.',
            'phone': '4431112233',
            'latitude': Decimal('19.860273'),
            'longitude': Decimal('-100.828562'),
            'opening_time': time(12, 0),
            'closing_time': time(23, 0),
        },
        'products': [
            ('Pizza mediana pepperoni', 'Masa artesanal, pepperoni y queso', '149.00'),
            ('Pizza familiar hawaiana', 'Jamón, piña y extra queso', '219.00'),
            ('Boneless 12 pzas', 'Con aderezo ranch o BBQ', '89.00'),
            ('Papas a la francesa', 'Porción grande', '55.00'),
            ('Cerveza michelada', 'Cerveza preparada 500 ml', '65.00'),
        ],
    },
    {
        'owner_username': 'rest_shukrani',
        'owner': {
            'first_name': 'Fernanda',
            'last_name': 'López',
            'email': 'shukrani@zinapp.test',
            'phone': '4432029496',
        },
        'restaurant': {
            'name': 'Shukrani Makis',
            'description': 'Rollos, makis y comida japonesa. Melchor Ocampo, centro.',
            'address': 'Calle Melchor Ocampo 46 Altos, Centro, 58930 Zinapécuaro de Figueroa, Mich.',
            'phone': '4432029496',
            'latitude': Decimal('19.860688'),
            'longitude': Decimal('-100.834336'),
            'opening_time': time(9, 0),
            'closing_time': time(18, 0),
        },
        'products': [
            ('Rollo California', '8 piezas, surimi y aguacate', '95.00'),
            ('Rollo philadelphia', 'Salmón y queso crema', '110.00'),
            ('Combo 2 rollos', 'A elegir + refresco', '175.00'),
            ('Yakimeshi', 'Arroz frito con verduras', '75.00'),
            ('Té verde', 'Vaso 500 ml', '25.00'),
        ],
    },
    {
        'owner_username': 'rest_jardines',
        'owner': {
            'first_name': 'Miguel',
            'last_name': 'Ireta',
            'email': 'jardines@zinapp.test',
            'phone': '4513550486',
        },
        'restaurant': {
            'name': 'Restaurante Jardines',
            'description': 'Comida mexicana en Félix Ireta. Antojitos, guisos y desayunos.',
            'address': 'Privada Las Clavelinas 22, Félix Ireta, 58930 Zinapécuaro de Figueroa, Mich.',
            'phone': '4513550486',
            'latitude': Decimal('19.864942'),
            'longitude': Decimal('-100.838514'),
            'opening_time': time(8, 0),
            'closing_time': time(21, 0),
        },
        'products': [
            ('Enchiladas verdes', '3 piezas con pollo y crema', '85.00'),
            ('Bistec ranchero', 'Con frijoles y arroz', '120.00'),
            ('Chilaquiles rojos', 'Con huevo y crema', '75.00'),
            ('Quesadilla grande', 'Tortilla de maíz con queso', '45.00'),
            ('Agua de jamaica', 'Jarra 1 litro', '35.00'),
        ],
    },
]

USERS = [
    {
        'username': 'admin_zinapp',
        'role': UserRole.ADMIN,
        'first_name': 'Admin',
        'last_name': 'ZinApp',
        'email': 'admin@zinapp.test',
        'phone': '4430000000',
        'address': 'Zinapécuaro de Figueroa, Mich.',
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'username': 'cliente1',
        'role': UserRole.CUSTOMER,
        'first_name': 'Ana',
        'last_name': 'García',
        'email': 'cliente@zinapp.test',
        'phone': '4434567890',
        'address': 'Av. Melchor Ocampo 30, Centro, Zinapécuaro de Figueroa, Mich.',
    },
    {
        'username': 'repartidor1',
        'role': UserRole.DRIVER,
        'first_name': 'Jorge',
        'last_name': 'Hernández',
        'email': 'repartidor@zinapp.test',
        'phone': '4435678901',
        'address': 'Col. Félix Ireta, Zinapécuaro de Figueroa, Mich.',
    },
]


class Command(BaseCommand):
    help = 'Carga datos de prueba para ZinApp (Zinapécuaro)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Elimina datos de prueba antes de volver a crearlos',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            self._reset()

        self._create_users()
        self._create_restaurants()
        self._create_coupons()
        self._create_driver_profile()
        self._print_summary()

    def _reset(self):
        self.stdout.write('Reiniciando datos de prueba (sin borrar pedidos históricos)...')
        old_restaurant_names = [
            'Tacos El Portal',
            'Birriería La Michoacana',
            'Nevería La Plaza',
            'Pizzas & Beer',
            'Shukrani Makis',
            'Restaurante Jardines',
        ]
        Restaurant.objects.filter(name__in=old_restaurant_names).delete()

    def _create_user(self, data: dict) -> User:
        user, created = User.objects.get_or_create(
            username=data['username'],
            defaults={
                'email': data.get('email', ''),
                'first_name': data.get('first_name', ''),
                'last_name': data.get('last_name', ''),
                'role': data['role'],
                'phone': data.get('phone', ''),
                'address': data.get('address', ''),
                'is_staff': data.get('is_staff', False),
                'is_superuser': data.get('is_superuser', False),
            },
        )
        user.set_password(DEFAULT_PASSWORD)
        user.save()
        action = 'Creado' if created else 'Actualizado'
        self.stdout.write(f'  {action}: {user.username} ({user.get_role_display()})')
        return user

    def _create_users(self):
        self.stdout.write(self.style.MIGRATE_HEADING('Usuarios'))
        for user_data in USERS:
            self._create_user(user_data)

    def _migrate_legacy_usernames(self):
        """Renombra cuentas del seed anterior al nombre del restaurante actual."""
        legacy = {
            'rest_tacos': 'rest_pizzas',
            'rest_birria': 'rest_shukrani',
            'rest_nieves': 'rest_jardines',
        }
        for old, new in legacy.items():
            try:
                user = User.objects.get(username=old)
                if not User.objects.filter(username=new).exists():
                    user.username = new
                    user.save(update_fields=['username'])
                    self.stdout.write(f'  Usuario renombrado: {old} -> {new}')
            except User.DoesNotExist:
                pass

    def _create_restaurants(self):
        self.stdout.write(self.style.MIGRATE_HEADING('Restaurantes y menús'))
        self._migrate_legacy_usernames()
        for entry in RESTAURANTS:
            owner_data = {'username': entry['owner_username'], 'role': UserRole.RESTAURANT, **entry['owner']}
            owner = self._create_user(owner_data)

            restaurant, created = Restaurant.objects.get_or_create(
                name=entry['restaurant']['name'],
                owner=owner,
                defaults=entry['restaurant'],
            )
            if not created:
                for field, value in entry['restaurant'].items():
                    setattr(restaurant, field, value)
                restaurant.save()
            action = 'Creado' if created else 'Actualizado'
            self.stdout.write(f'  {action}: {restaurant.name}')

            for name, description, price in entry['products']:
                Product.objects.get_or_create(
                    restaurant=restaurant,
                    name=name,
                    defaults={
                        'description': description,
                        'price': Decimal(price),
                        'is_available': True,
                    },
                )

    def _create_coupons(self):
        self.stdout.write(self.style.MIGRATE_HEADING('Cupones'))
        coupons = [
            {'code': 'ZINA10', 'description': '10% de descuento', 'discount_percent': 10},
            {'code': 'ENVIO0', 'description': 'Envío gratis (próximo pedido)', 'discount_fixed': Decimal('25.00')},
        ]
        for data in coupons:
            Coupon.objects.update_or_create(code=data['code'], defaults={**data, 'is_active': True})
            self.stdout.write(f'  Cupón: {data["code"]}')

    def _create_driver_profile(self):
        self.stdout.write(self.style.MIGRATE_HEADING('Perfil de repartidor'))
        driver = User.objects.get(username='repartidor1')
        profile, created = DeliveryProfile.objects.get_or_create(
            user=driver,
            defaults={
                'vehicle_type': DeliveryProfile.VehicleType.MOTORCYCLE,
                'license_plate': 'MICH-123-A',
                'is_available': True,
            },
        )
        if not created:
            profile.is_available = True
            profile.save()
        self.stdout.write(f'  Repartidor listo: {driver.username}')

    def _print_summary(self):
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Datos de prueba listos.'))
        self.stdout.write('')
        self.stdout.write('Contraseña para todos los usuarios: ' + DEFAULT_PASSWORD)
        self.stdout.write('')
        self.stdout.write('Cuentas:')
        self.stdout.write('  admin_zinapp   - Administrador')
        self.stdout.write('  cliente1       - Cliente')
        self.stdout.write('  repartidor1    - Repartidor')
        self.stdout.write('  rest_pizzas    - Pizzas & Beer')
        self.stdout.write('  rest_shukrani  - Shukrani Makis')
        self.stdout.write('  rest_jardines  - Restaurante Jardines')
        self.stdout.write('')
        self.stdout.write('Cupones: ZINA10 (10%), ENVIO0 ($25 descuento)')

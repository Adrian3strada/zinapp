from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase

from orders.models import Order, PaymentMethod, PaymentStatus
from restaurants.models import Product, ProductPromotion, PromoType, Restaurant
from restaurants.owned import get_active_restaurant

User = get_user_model()


class OwnerActiveRestaurantTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='multi_owner',
            password='test1234',
            role='restaurant',
        )
        self.other = User.objects.create_user(
            username='other_owner',
            password='test1234',
            role='restaurant',
        )
        self.centro = Restaurant.objects.create(
            owner=self.owner,
            name='Deli Centro',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.norte = Restaurant.objects.create(
            owner=self.owner,
            name='Deli Norte',
            address='Norte',
            is_active=True,
            accepting_orders=True,
        )
        self.alien = Restaurant.objects.create(
            owner=self.other,
            name='Otro Local',
            address='Otro',
            is_active=True,
            accepting_orders=True,
        )
        Product.objects.create(
            restaurant=self.centro,
            name='Taco Centro',
            price=Decimal('30.00'),
            is_available=True,
        )
        Product.objects.create(
            restaurant=self.norte,
            name='Taco Norte',
            price=Decimal('35.00'),
            is_available=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_mine_defaults_to_first_restaurant(self):
        response = self.client.get('/api/restaurants/mine/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.centro.id)
        names = {item['name'] for item in response.data['products']}
        self.assertEqual(names, {'Taco Centro'})

    def test_owned_lists_all_and_marks_selected(self):
        response = self.client.get('/api/restaurants/owned/')
        self.assertEqual(response.status_code, 200)
        ids = [row['id'] for row in response.data]
        self.assertEqual(ids, [self.centro.id, self.norte.id])
        selected = [row['id'] for row in response.data if row['is_selected']]
        self.assertEqual(selected, [self.centro.id])

    def test_select_changes_mine_and_owned(self):
        response = self.client.post(
            '/api/restaurants/mine/select/',
            {'restaurant_id': self.norte.id},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['id'], self.norte.id)

        self.owner.refresh_from_db()
        self.assertEqual(self.owner.active_restaurant_id, self.norte.id)
        self.assertEqual(get_active_restaurant(self.owner).id, self.norte.id)

        mine = self.client.get('/api/restaurants/mine/')
        self.assertEqual(mine.data['id'], self.norte.id)
        names = {item['name'] for item in mine.data['products']}
        self.assertEqual(names, {'Taco Norte'})

        owned = self.client.get('/api/restaurants/owned/')
        selected = [row['id'] for row in owned.data if row['is_selected']]
        self.assertEqual(selected, [self.norte.id])

    def test_select_rejects_foreign_restaurant(self):
        response = self.client.post(
            '/api/restaurants/mine/select/',
            {'restaurant_id': self.alien.id},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_select_rejects_invalid_id(self):
        response = self.client.post(
            '/api/restaurants/mine/select/',
            {'restaurant_id': 'abc'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_customer_cannot_list_owned(self):
        customer = User.objects.create_user(
            username='multi_customer',
            password='test1234',
            role='customer',
        )
        self.client.force_authenticate(customer)
        response = self.client.get('/api/restaurants/owned/')
        self.assertEqual(response.status_code, 403)

    def test_pending_and_today_use_active_restaurant(self):
        customer = User.objects.create_user(
            username='multi_buyer',
            password='test1234',
            role='customer',
        )
        order_centro = Order.objects.create(
            customer=customer,
            restaurant=self.centro,
            delivery_address='Calle 1',
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            subtotal=Decimal('30.00'),
            delivery_fee=Decimal('25.00'),
            total=Decimal('55.00'),
        )
        order_norte = Order.objects.create(
            customer=customer,
            restaurant=self.norte,
            delivery_address='Calle 2',
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            subtotal=Decimal('40.00'),
            delivery_fee=Decimal('25.00'),
            total=Decimal('65.00'),
        )

        pending = self.client.get('/api/orders/restaurant-pending/')
        self.assertEqual(pending.status_code, 200)
        self.assertEqual({row['id'] for row in pending.data}, {order_centro.id})

        today = self.client.get('/api/orders/restaurant-today/')
        self.assertEqual(today.status_code, 200)
        self.assertEqual(today.data['orders_created'], 1)

        self.client.post(
            '/api/restaurants/mine/select/',
            {'restaurant_id': self.norte.id},
            format='json',
        )
        pending = self.client.get('/api/orders/restaurant-pending/')
        self.assertEqual({row['id'] for row in pending.data}, {order_norte.id})

        today = self.client.get('/api/orders/restaurant-today/')
        self.assertEqual(today.data['orders_created'], 1)

    def test_promotions_mine_uses_active_restaurant(self):
        from django.utils import timezone
        from datetime import timedelta

        ProductPromotion.objects.create(
            restaurant=self.norte,
            product=Product.objects.get(name='Taco Norte'),
            promo_type=PromoType.PERCENT_OFF,
            percent_off=10,
            valid_until=timezone.now() + timedelta(days=2),
        )
        empty = self.client.get('/api/promotions/mine/')
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty.data, [])

        self.client.post(
            '/api/restaurants/mine/select/',
            {'restaurant_id': self.norte.id},
            format='json',
        )
        with_promo = self.client.get('/api/promotions/mine/')
        self.assertEqual(len(with_promo.data), 1)

    def test_register_sets_active_restaurant(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'new_multi',
                'email': 'new_multi@example.com',
                'password': 'test1234',
                'password_confirm': 'test1234',
                'first_name': 'Ana',
                'last_name': 'Ruiz',
                'role': 'restaurant',
                'phone': '4431234567',
                'restaurant_name': 'Mi Fonda',
                'restaurant_address': 'Av. Principal, Zinapécuaro',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(username='new_multi')
        self.assertIsNotNone(user.active_restaurant_id)
        self.assertEqual(user.active_restaurant.name, 'Mi Fonda')

    def test_owner_can_create_another_restaurant(self):
        response = self.client.post(
            '/api/restaurants/owned/',
            {
                'name': 'Deli Sur',
                'address': 'Col. Las Galeras, Zinapécuaro',
                'phone': '4431234567',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['name'], 'Deli Sur')
        self.assertFalse(response.data['is_active'])
        self.assertTrue(response.data['is_selected'])

        created = Restaurant.objects.get(name='Deli Sur', owner=self.owner)
        self.assertFalse(created.accepting_orders)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.active_restaurant_id, created.id)

        mine = self.client.get('/api/restaurants/mine/')
        self.assertEqual(mine.data['id'], created.id)

    def test_create_owned_requires_name_and_address(self):
        response = self.client.post(
            '/api/restaurants/owned/',
            {'name': 'X', 'address': ''},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_create_owned_enforces_limit(self):
        from restaurants.owned import MAX_OWNED_RESTAURANTS

        for i in range(MAX_OWNED_RESTAURANTS - 2):
            Restaurant.objects.create(
                owner=self.owner,
                name=f'Extra {i}',
                address='Centro',
            )
        response = self.client.post(
            '/api/restaurants/owned/',
            {'name': 'Uno más', 'address': 'Centro, Zinapécuaro'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('8', response.data['detail'])

from datetime import time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from orders.models import Coupon, Order, OrderItem, OrderSource, OrderStatus, PaymentMethod
from restaurants.models import (
    Product,
    ProductFavorite,
    ProductOption,
    ProductOptionGroup,
    ProductPromotion,
    PromoType,
    Restaurant,
    RestaurantBusinessHour,
    RestaurantCategory,
    RestaurantFavorite,
)

User = get_user_model()


class CustomerHomeApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='home_customer',
            password='test1234',
            role='customer',
            first_name='Adrián',
        )
        self.owner = User.objects.create_user(
            username='home_owner',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Al Carbón de Don Frank',
            category=RestaurantCategory.HAMBURGUESAS,
            address='Centro, Zinapécuaro',
            is_active=True,
            accepting_orders=True,
        )
        today = timezone.localtime().weekday()
        RestaurantBusinessHour.objects.create(
            restaurant=self.restaurant,
            day_of_week=today,
            is_closed=False,
            opening_time=time(0, 0),
            closing_time=time(23, 59),
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Hamburguesa Especial',
            price=Decimal('150.00'),
            is_available=True,
        )
        self.empty_owner = User.objects.create_user(
            username='empty_owner',
            password='test1234',
            role='restaurant',
        )
        Restaurant.objects.create(
            owner=self.empty_owner,
            name='Sin menú',
            category=RestaurantCategory.PIZZAS,
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )

    def test_guest_home_hides_personal_blocks_and_empty_categories(self):
        response = self.client.get('/api/home/')
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        keys = {row['key'] for row in data['categories']}
        self.assertIn('hamburguesas', keys)
        self.assertNotIn('pizzas', keys)
        self.assertEqual(len(data['open_restaurants']), 1)
        self.assertEqual(data['open_restaurants'][0]['name'], 'Al Carbón de Don Frank')
        self.assertFalse(data['open_restaurants'][0]['is_favorited'])
        self.assertEqual(data['favorites']['restaurants'], [])
        self.assertEqual(data['favorites']['products'], [])
        self.assertEqual(data['recent_orders'], [])
        self.assertEqual(data['coupons'], [])
        self.assertIn(self.restaurant.id, [row['id'] for row in data['new_restaurants']])

    def test_customer_home_includes_favorites_reorder_and_coupons(self):
        Coupon.objects.create(code='ZINA10', discount_percent=10, is_active=True)
        RestaurantFavorite.objects.create(user=self.customer, restaurant=self.restaurant)
        ProductFavorite.objects.create(user=self.customer, product=self.product)
        order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.DELIVERED,
            source=OrderSource.ZINAPP,
            delivery_address='Calle 1',
            payment_method=PaymentMethod.CASH,
            subtotal=Decimal('150.00'),
            delivery_fee=Decimal('25.00'),
            total=Decimal('175.00'),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=1,
            unit_price=Decimal('140.00'),
        )
        self.client.force_authenticate(self.customer)
        response = self.client.get('/api/home/')
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(len(data['favorites']['restaurants']), 1)
        self.assertTrue(data['favorites']['restaurants'][0]['is_favorited'])
        self.assertTrue(data['open_restaurants'][0]['is_favorited'])
        self.assertEqual(data['favorites']['products'][0]['id'], self.product.id)
        self.assertEqual(data['recent_orders'][0]['id'], order.id)
        self.assertIn('Hamburguesa Especial', data['recent_orders'][0]['summary'])
        self.assertEqual(data['coupons'][0]['code'], 'ZINA10')

    def test_home_promotions_only_active(self):
        ProductPromotion.objects.create(
            restaurant=self.restaurant,
            product=self.product,
            promo_type=PromoType.PERCENT_OFF,
            percent_off=20,
            valid_until=timezone.now() + timedelta(days=1),
        )
        expired_product = Product.objects.create(
            restaurant=self.restaurant,
            name='Vieja promo',
            price=Decimal('10.00'),
            is_available=True,
        )
        ProductPromotion.objects.create(
            restaurant=self.restaurant,
            product=expired_product,
            promo_type=PromoType.TWO_FOR_ONE,
            valid_until=timezone.now() - timedelta(hours=1),
        )
        response = self.client.get('/api/home/')
        self.assertEqual(response.status_code, 200)
        labels = [row['product_name'] for row in response.data['promotions']]
        self.assertEqual(labels, ['Hamburguesa Especial'])
        self.assertTrue(response.data['open_restaurants'][0]['has_active_promo'])

    def test_toggle_product_favorite(self):
        self.client.force_authenticate(self.customer)
        url = f'/api/products/{self.product.id}/toggle-favorite/'
        added = self.client.post(url)
        self.assertEqual(added.status_code, 200)
        self.assertTrue(added.data['is_favorited'])
        self.assertTrue(
            ProductFavorite.objects.filter(user=self.customer, product=self.product).exists()
        )
        removed = self.client.post(url)
        self.assertFalse(removed.data['is_favorited'])

    def test_guest_cannot_toggle_favorite(self):
        response = self.client.post(f'/api/products/{self.product.id}/toggle-favorite/')
        self.assertEqual(response.status_code, 401)

    def test_restaurant_search_matches_product_name(self):
        response = self.client.get('/api/restaurants/', {'q': 'Hamburguesa'})
        self.assertEqual(response.status_code, 200)
        names = [row['name'] for row in response.data['results']]
        self.assertIn('Al Carbón de Don Frank', names)

    def test_reorder_preview_uses_current_price_and_skips_missing_options(self):
        group = ProductOptionGroup.objects.create(
            product=self.product,
            name='Extras',
            min_select=0,
            max_select=2,
        )
        extra = ProductOption.objects.create(group=group, name='Papas', price_delta=Decimal('20.00'))
        gone = ProductOption.objects.create(
            group=group,
            name='Aros',
            price_delta=Decimal('15.00'),
            is_available=False,
        )
        order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.DELIVERED,
            source=OrderSource.ZINAPP,
            delivery_address='Calle 1',
            payment_method=PaymentMethod.CASH,
            subtotal=Decimal('185.00'),
            delivery_fee=Decimal('25.00'),
            total=Decimal('210.00'),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=2,
            unit_price=Decimal('140.00'),
            selected_options=[
                {'id': extra.id, 'group_id': group.id, 'group': 'Extras', 'name': 'Papas', 'price_delta': '10.00'},
                {'id': gone.id, 'group_id': group.id, 'group': 'Extras', 'name': 'Aros', 'price_delta': '15.00'},
            ],
        )
        self.product.price = Decimal('160.00')
        self.product.save(update_fields=['price'])
        self.client.force_authenticate(self.customer)
        response = self.client.post(f'/api/orders/{order.id}/reorder-preview/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['items'][0]['current_unit_price'], '180.00')
        self.assertEqual(response.data['current_subtotal'], '360.00')
        self.assertEqual(len(response.data['items'][0]['selected_options']), 1)
        self.assertEqual(response.data['items'][0]['selected_options'][0]['name'], 'Papas')
        self.assertTrue(response.data['items'][0]['warnings'])

    def test_reorder_preview_rejects_inactive_restaurant(self):
        order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.DELIVERED,
            source=OrderSource.ZINAPP,
            delivery_address='Calle 1',
            payment_method=PaymentMethod.CASH,
            subtotal=Decimal('150.00'),
            delivery_fee=Decimal('25.00'),
            total=Decimal('175.00'),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=1,
            unit_price=Decimal('150.00'),
        )
        self.restaurant.is_active = False
        self.restaurant.save(update_fields=['is_active'])
        self.client.force_authenticate(self.customer)
        response = self.client.post(f'/api/orders/{order.id}/reorder-preview/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'restaurant_inactive')


class CustomerSearchAndFavoritesTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='search_customer',
            password='test1234',
            role='customer',
        )
        self.owner = User.objects.create_user(
            username='search_owner',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Taquería El Puesto',
            category=RestaurantCategory.TACOS,
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Tacos al pastor',
            price=Decimal('25.00'),
            is_available=True,
        )
        from local_services.models import LocalService, LocalServiceCategory
        LocalService.objects.create(
            name='Clínica Animal',
            category=LocalServiceCategory.PETS,
            description='Consultas y vacunas',
            is_active=True,
        )

    def test_search_short_query_returns_empty_groups(self):
        response = self.client.get('/api/search/', {'q': 't'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['restaurants'], [])
        self.assertEqual(response.data['products'], [])
        self.assertEqual(response.data['services'], [])
        self.assertEqual(response.data['categories'], [])

    def test_search_tacos_returns_category_restaurant_and_product(self):
        response = self.client.get('/api/search/', {'q': 'tacos'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn('tacos', {row['key'] for row in response.data['categories']})
        self.assertIn('Taquería El Puesto', {row['name'] for row in response.data['restaurants']})
        self.assertIn('Tacos al pastor', {row['name'] for row in response.data['products']})

    def test_search_veterinario_returns_pet_services(self):
        response = self.client.get('/api/search/', {'q': 'veterinario'})
        self.assertEqual(response.status_code, 200, response.data)
        names = {row['name'] for row in response.data['services']}
        self.assertIn('Clínica Animal', names)

    def test_favorites_empty_for_guest(self):
        response = self.client.get('/api/favorites/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['restaurants'], [])
        self.assertEqual(response.data['products'], [])

    def test_favorites_list_for_customer(self):
        RestaurantFavorite.objects.create(user=self.customer, restaurant=self.restaurant)
        ProductFavorite.objects.create(user=self.customer, product=self.product)
        self.client.force_authenticate(self.customer)
        response = self.client.get('/api/favorites/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['restaurants'][0]['id'], self.restaurant.id)
        self.assertEqual(response.data['products'][0]['id'], self.product.id)

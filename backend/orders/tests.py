from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from orders.models import Coupon, Order, OrderStatus
from restaurants.models import Restaurant

User = get_user_model()


class OrderApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='testclient',
            password='test1234',
            role='customer',
        )
        self.owner = User.objects.create_user(
            username='testowner',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Test Rest',
            address='Centro, Zinapécuaro',
            latitude=Decimal('19.860273'),
            longitude=Decimal('-100.828562'),
            is_active=True,
            accepting_orders=True,
        )
        Coupon.objects.create(code='ZINA10', discount_percent=10, is_active=True)

    def test_register_restaurant_creates_restaurant(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'newrest',
            'password': 'test1234',
            'password_confirm': 'test1234',
            'role': 'restaurant',
            'phone': '4431234567',
            'restaurant_name': 'Mi Fonda',
            'restaurant_address': 'Av. Principal, Zinapécuaro',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='newrest')
        rest = Restaurant.objects.get(owner=user, name='Mi Fonda')
        self.assertFalse(rest.is_active)
        self.assertFalse(rest.accepting_orders)

    def test_order_rejected_when_restaurant_inactive(self):
        from restaurants.models import Product

        self.restaurant.is_active = False
        self.restaurant.save(update_fields=['is_active'])
        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        response = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('restaurant_id', response.data)

    def test_coupon_validate(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post('/api/coupons/validate/', {
            'code': 'ZINA10',
            'subtotal': '100.00',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(str(response.data['discount_amount']), '10.00')

    def test_create_order_with_coupon(self):
        from restaurants.models import Product

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        response = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'coupon_code': 'ZINA10',
            'items': [{'product_id': product.id, 'quantity': 2}],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['discount_amount'], '10.00')
        self.assertTrue(response.data['code'])
        self.assertEqual(len(response.data['code']), 6)

    def test_order_code_is_unique(self):
        from restaurants.models import Product

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        payload = {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }
        first = self.client.post('/api/orders/', payload, format='json')
        second = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertNotEqual(first.data['code'], second.data['code'])

    def test_create_order_rounds_high_precision_coordinates(self):
        from restaurants.models import Product

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        response = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': 19.860273456789012345,
            'delivery_longitude': -100.828562678901234,
            'payment_method': 'cash',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(str(response.data['delivery_latitude']), '19.860273')
        self.assertEqual(str(response.data['delivery_longitude']), '-100.828563')

    def test_driver_can_view_available_order_detail(self):
        from restaurants.models import Product

        driver = User.objects.create_user(
            username='testdriver',
            password='test1234',
            role='driver',
        )
        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        create_resp = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }, format='json')
        order_id = create_resp.data['id']

        self.client.force_authenticate(self.owner)
        self.client.post(f'/api/orders/{order_id}/accept/')
        self.client.post(f'/api/orders/{order_id}/update-status/', {'status': 'preparing'})
        self.client.post(f'/api/orders/{order_id}/update-status/', {'status': 'ready'})

        self.client.force_authenticate(driver)
        response = self.client.get(f'/api/orders/{order_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], OrderStatus.READY)

    def test_invalid_coupon_does_not_create_order(self):
        from restaurants.models import Product

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        before = Order.objects.count()
        response = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'coupon_code': 'INVALID',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), before)

    def test_customer_can_cancel_pending_order(self):
        from restaurants.models import Product

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        create_resp = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }, format='json')
        order_id = create_resp.data['id']

        cancel_resp = self.client.post(f'/api/orders/{order_id}/cancel/')
        self.assertEqual(cancel_resp.status_code, 200)
        self.assertEqual(cancel_resp.data['status'], OrderStatus.CANCELLED)

    def test_customer_cannot_cancel_ready_order(self):
        from restaurants.models import Product

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        create_resp = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }, format='json')
        order_id = create_resp.data['id']

        self.client.force_authenticate(self.owner)
        self.client.post(f'/api/orders/{order_id}/accept/')
        self.client.post(f'/api/orders/{order_id}/update-status/', {'status': 'preparing'})
        self.client.post(f'/api/orders/{order_id}/update-status/', {'status': 'ready'})

        self.client.force_authenticate(self.customer)
        cancel_resp = self.client.post(f'/api/orders/{order_id}/cancel/')
        self.assertEqual(cancel_resp.status_code, 400)

    def test_shipment_accept_sets_picked_up_status(self):
        driver = User.objects.create_user(
            username='shipdriver',
            password='test1234',
            role='driver',
        )
        self.client.force_authenticate(self.customer)
        create_resp = self.client.post('/api/shipments/', {
            'description': 'Paquete pequeño',
            'size': 'small',
            'pickup_address': 'Origen, Zinapécuaro',
            'pickup_latitude': '19.860273',
            'pickup_longitude': '-100.828562',
            'delivery_address': 'Destino, Zinapécuaro',
            'delivery_latitude': '19.865000',
            'delivery_longitude': '-100.830000',
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(create_resp.status_code, 201)
        shipment_id = create_resp.data['id']

        self.client.force_authenticate(driver)
        accept_resp = self.client.post(f'/api/shipments/{shipment_id}/accept-delivery/')
        self.assertEqual(accept_resp.status_code, 200)
        self.assertEqual(accept_resp.data['status'], 'picked_up')

        mark_resp = self.client.post(f'/api/shipments/{shipment_id}/mark-picked-up/')
        self.assertEqual(mark_resp.status_code, 200)
        self.assertEqual(mark_resp.data['status'], 'on_the_way')

        deliver_resp = self.client.post(f'/api/shipments/{shipment_id}/mark-delivered/')
        self.assertEqual(deliver_resp.status_code, 200)
        self.assertEqual(deliver_resp.data['status'], 'delivered')

    def test_restaurant_owner_can_update_own_product(self):
        from restaurants.models import Product

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Quesadilla',
            price=Decimal('40.00'),
        )
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            f'/api/products/{product.id}/',
            {'name': 'Quesadilla grande', 'price': '45.00'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Quesadilla grande')

    def test_customer_active_orders_endpoint(self):
        from restaurants.models import Product

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
        )
        self.client.force_authenticate(self.customer)
        create_resp = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1, Zinapécuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(create_resp.status_code, 201)

        active_resp = self.client.get('/api/orders/active/')
        self.assertEqual(active_resp.status_code, 200)
        self.assertEqual(len(active_resp.data), 1)
        self.assertEqual(active_resp.data[0]['status'], OrderStatus.PENDING)
        self.assertIn('restaurant_name', active_resp.data[0])

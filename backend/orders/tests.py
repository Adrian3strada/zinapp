from decimal import Decimal
import hashlib
import hmac
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import AuditLog
from orders.models import Coupon, Order, OrderStatus, PaymentMethod, PaymentStatus
from restaurants.models import Restaurant

User = get_user_model()


def mercadopago_signature_headers(payment_id, secret='mp_webhook_secret', request_id='req-123', ts='1700000000'):
    manifest = f'id:{payment_id};request-id:{request_id};ts:{ts};'
    digest = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return {
        'HTTP_X_SIGNATURE': f'ts={ts},v1={digest}',
        'HTTP_X_REQUEST_ID': request_id,
    }


class OrderApiTests(TestCase):
    def setUp(self):
        cache.clear()
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
            'email': 'newrest@example.com',
            'password': 'test1234',
            'password_confirm': 'test1234',
            'first_name': 'María',
            'last_name': 'López',
            'role': 'restaurant',
            'phone': '4431234567',
            'restaurant_name': 'Mi Fonda',
            'restaurant_address': 'Av. Principal, Zinapécuaro',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
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
        self.client.post(f'/api/orders/{order_id}/update-status/', {'status': 'ready'})

        self.client.force_authenticate(driver)
        response = self.client.get(f'/api/orders/{order_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], OrderStatus.READY)
        self.assertIn('customer_detail', response.data)
        self.assertEqual(response.data['customer_detail']['username'], self.customer.username)
        self.assertNotIn('email', response.data['customer_detail'])
        self.assertNotIn('expo_push_token', response.data['customer_detail'])

    def test_customer_sees_driver_profile_on_assigned_order(self):
        from accounts.models import DeliveryProfile
        from restaurants.models import Product

        driver = User.objects.create_user(
            username='driverprofile',
            password='test1234',
            role='driver',
            first_name='Luis',
            phone='4431234567',
        )
        DeliveryProfile.objects.create(
            user=driver,
            vehicle_type=DeliveryProfile.VehicleType.MOTORCYCLE,
            license_plate='ABC-123',
            verification_status=DeliveryProfile.VerificationStatus.APPROVED,
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
        self.client.post(f'/api/orders/{order_id}/update-status/', {'status': 'ready'})

        self.client.force_authenticate(driver)
        self.client.post(f'/api/orders/{order_id}/accept-delivery/')

        self.client.force_authenticate(self.customer)
        response = self.client.get(f'/api/orders/{order_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['driver_detail']['first_name'], 'Luis')
        self.assertNotIn('email', response.data['driver_detail'])
        profile = response.data['driver_delivery_profile']
        self.assertEqual(profile['vehicle_type'], 'motorcycle')
        self.assertEqual(profile['license_plate'], 'ABC-123')

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
        self.client.post(f'/api/orders/{order_id}/update-status/', {'status': 'ready'})

        self.client.force_authenticate(self.customer)
        cancel_resp = self.client.post(f'/api/orders/{order_id}/cancel/')
        self.assertEqual(cancel_resp.status_code, 400)

    def test_shipment_accept_sets_picked_up_status(self):
        from accounts.models import DeliveryProfile

        driver = User.objects.create_user(
            username='shipdriver',
            password='test1234',
            role='driver',
        )
        DeliveryProfile.objects.create(
            user=driver,
            vehicle_type=DeliveryProfile.VehicleType.MOTORCYCLE,
            license_plate='SHIP-1',
            verification_status=DeliveryProfile.VerificationStatus.APPROVED,
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

    def test_create_mandado_shipment(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post('/api/shipments/', {
            'kind': 'mandado',
            'mandado_items': [
                {
                    'name': 'Jitomate',
                    'quantity': '1',
                    'unit': 'kg',
                    'category': 'verdura',
                },
            ],
            'preferred_stores': 'Central de abastos',
            'pickup_address': 'Central de abastos',
            'size': 'medium',
            'delivery_address': 'Destino, Zinapécuaro',
            'delivery_latitude': '19.865000',
            'delivery_longitude': '-100.830000',
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['kind'], 'mandado')
        self.assertEqual(len(response.data['mandado_details']['items']), 1)

    def test_create_mandado_with_article_only_items(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post('/api/shipments/', {
            'kind': 'mandado',
            'mandado_items': [
                {'name': 'Leche entera', 'category': 'lacteos'},
                {'name': 'Pan blanco', 'quantity': '2', 'unit': 'pza', 'category': 'abarrotes'},
                {'name': 'Jitomate', 'quantity': '1.5', 'unit': 'kg', 'category': 'verdura'},
            ],
            'preferred_stores': 'Abarrotes Don Pepe',
            'pickup_address': 'Abarrotes Don Pepe',
            'size': 'medium',
            'delivery_address': 'Destino, Zinapécuaro',
            'delivery_latitude': '19.865000',
            'delivery_longitude': '-100.830000',
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        items = response.data['mandado_details']['items']
        self.assertEqual(items[0]['name'], 'Leche entera')
        self.assertNotIn('quantity', items[0])
        self.assertEqual(items[1]['unit'], 'pza')
        self.assertIn('Leche entera', response.data['description'])

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


@override_settings(MERCADOPAGO_WEBHOOK_SECRET='mp_webhook_secret')
class MercadoPagoWebhookTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='mp_customer',
            password='test1234',
            role='customer',
        )
        self.owner = User.objects.create_user(
            username='mp_owner',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='MP Rest',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            delivery_address='Calle 1',
            payment_method=PaymentMethod.ONLINE,
            payment_status=PaymentStatus.PENDING,
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('25.00'),
            total=Decimal('125.00'),
        )

    def payment_payload(self, **overrides):
        payload = {
            'status': 'approved',
            'external_reference': str(self.order.id),
            'transaction_amount': '125.00',
            'currency_id': 'MXN',
            'metadata': {'order_id': self.order.id, 'type': 'order'},
        }
        payload.update(overrides)
        return payload

    @patch('orders.mercadopago.fetch_payment')
    def test_signed_webhook_marks_matching_order_paid(self, mock_fetch):
        mock_fetch.return_value = self.payment_payload()

        response = self.client.post(
            '/api/payments/mercadopago/webhook/',
            {'type': 'payment', 'data': {'id': 'pay_123'}},
            format='json',
            **mercadopago_signature_headers('pay_123'),
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PAID)
        self.assertEqual(self.order.mercadopago_payment_id, 'pay_123')
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.MP_WEBHOOK_PAID,
                object_type='Order',
                object_id=str(self.order.id),
            ).exists()
        )

    @patch('orders.mercadopago.fetch_payment')
    def test_invalid_signature_rejects_webhook_before_fetch(self, mock_fetch):
        response = self.client.post(
            '/api/payments/mercadopago/webhook/',
            {'type': 'payment', 'data': {'id': 'pay_123'}},
            format='json',
            HTTP_X_SIGNATURE='ts=1700000000,v1=bad',
            HTTP_X_REQUEST_ID='req-123',
        )

        self.assertEqual(response.status_code, 401)
        mock_fetch.assert_not_called()
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PENDING)

    @patch('orders.mercadopago.fetch_payment')
    def test_amount_mismatch_does_not_mark_order_paid(self, mock_fetch):
        mock_fetch.return_value = self.payment_payload(transaction_amount='126.00')

        response = self.client.post(
            '/api/payments/mercadopago/webhook/',
            {'type': 'payment', 'data': {'id': 'pay_123'}},
            format='json',
            **mercadopago_signature_headers('pay_123'),
        )

        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PENDING)

    @patch('orders.mercadopago.fetch_payment')
    def test_wrong_currency_does_not_mark_order_paid(self, mock_fetch):
        mock_fetch.return_value = self.payment_payload(currency_id='USD')

        response = self.client.post(
            '/api/payments/mercadopago/webhook/',
            {'type': 'payment', 'data': {'id': 'pay_123'}},
            format='json',
            **mercadopago_signature_headers('pay_123'),
        )

        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PENDING)

    @patch('orders.mercadopago.fetch_payment')
    def test_cancelled_order_is_not_marked_paid(self, mock_fetch):
        self.order.status = OrderStatus.CANCELLED
        self.order.save(update_fields=['status', 'updated_at'])
        mock_fetch.return_value = self.payment_payload()

        response = self.client.post(
            '/api/payments/mercadopago/webhook/',
            {'type': 'payment', 'data': {'id': 'pay_123'}},
            format='json',
            **mercadopago_signature_headers('pay_123'),
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PENDING)


@override_settings(
    STRIPE_SECRET_KEY='sk_test_dummy',
    STRIPE_WEBHOOK_SECRET='whsec_test_secret',
)
class StripeWebhookTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='stripe_customer',
            password='test1234',
            role='customer',
        )
        self.owner = User.objects.create_user(
            username='stripe_owner',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Stripe Rest',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            delivery_address='Calle 1',
            payment_method=PaymentMethod.ONLINE,
            payment_status=PaymentStatus.PENDING,
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('25.00'),
            total=Decimal('125.00'),
        )

    def session_completed_event(self, **overrides):
        session = {
            'id': 'cs_test_123',
            'object': 'checkout.session',
            'payment_status': 'paid',
            'status': 'complete',
            'currency': 'mxn',
            'amount_total': 12500,
            'client_reference_id': str(self.order.id),
            'payment_intent': 'pi_test_123',
            'metadata': {'order_id': str(self.order.id), 'type': 'order'},
        }
        session.update(overrides)
        return {
            'id': 'evt_test_1',
            'type': 'checkout.session.completed',
            'data': {'object': session},
        }

    @patch('orders.stripe_payments.construct_webhook_event')
    def test_checkout_completed_marks_order_paid(self, mock_construct):
        mock_construct.return_value = self.session_completed_event()

        response = self.client.post(
            '/api/payments/stripe/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PAID)
        self.assertEqual(self.order.stripe_checkout_session_id, 'cs_test_123')
        self.assertEqual(self.order.stripe_payment_intent_id, 'pi_test_123')
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.STRIPE_WEBHOOK_PAID,
                object_type='Order',
                object_id=str(self.order.id),
            ).exists()
        )

    @patch('orders.stripe_payments.construct_webhook_event')
    def test_invalid_signature_rejects_webhook(self, mock_construct):
        mock_construct.side_effect = Exception('bad sig')

        response = self.client.post(
            '/api/payments/stripe/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=bad',
        )

        self.assertEqual(response.status_code, 401)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PENDING)

    @patch('orders.stripe_payments.construct_webhook_event')
    def test_amount_mismatch_does_not_mark_order_paid(self, mock_construct):
        mock_construct.return_value = self.session_completed_event(amount_total=12600)

        response = self.client.post(
            '/api/payments/stripe/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )

        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PENDING)

    @patch('orders.stripe_payments.construct_webhook_event')
    def test_wrong_currency_does_not_mark_order_paid(self, mock_construct):
        mock_construct.return_value = self.session_completed_event(currency='usd')

        response = self.client.post(
            '/api/payments/stripe/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )

        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PENDING)

    @patch('orders.stripe_payments.construct_webhook_event')
    def test_idempotent_when_already_paid(self, mock_construct):
        self.order.payment_status = PaymentStatus.PAID
        self.order.save(update_fields=['payment_status', 'updated_at'])
        mock_construct.return_value = self.session_completed_event()

        response = self.client.post(
            '/api/payments/stripe/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PAID)

    @patch('orders.stripe_payments.construct_webhook_event')
    def test_cancelled_order_is_not_marked_paid(self, mock_construct):
        self.order.status = OrderStatus.CANCELLED
        self.order.save(update_fields=['status', 'updated_at'])
        mock_construct.return_value = self.session_completed_event()

        response = self.client.post(
            '/api/payments/stripe/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PENDING)

    def test_awaits_online_payment_property(self):
        self.assertTrue(self.order.awaits_online_payment)
        self.order.payment_status = PaymentStatus.PAID
        self.order.save(update_fields=['payment_status', 'updated_at'])
        self.assertFalse(self.order.awaits_online_payment)

    def test_restaurant_pending_hides_unpaid_online(self):
        paid = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            delivery_address='Calle 2',
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            subtotal=Decimal('50.00'),
            delivery_fee=Decimal('25.00'),
            total=Decimal('75.00'),
        )
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/api/orders/restaurant-pending/')
        self.assertEqual(response.status_code, 200)
        ids = {row['id'] for row in response.data}
        self.assertNotIn(self.order.id, ids)
        self.assertIn(paid.id, ids)

        self.order.payment_status = PaymentStatus.PAID
        self.order.save(update_fields=['payment_status', 'updated_at'])
        response = self.client.get('/api/orders/restaurant-pending/')
        ids = {row['id'] for row in response.data}
        self.assertIn(self.order.id, ids)

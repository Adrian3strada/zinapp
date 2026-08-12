from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import UserRole
from accounts.notifications import notify_order_status, notify_review_reminder
from orders.models import Order, OrderSource, OrderStatus, PaymentMethod, PaymentStatus
from restaurants.models import Product, ProductCategory, Restaurant
from realtime.broadcast import broadcast_order_updated

from pos.access import SESSION_RESTAURANT_KEY, accessible_restaurants_qs
from pos.exceptions import PosError
from pos.models import CashMovement, CashMovementType, POSStaffMembership, POSStaffRole
from pos.services.cash import open_cash_session
from pos.services.sales import create_pos_sale

User = get_user_model()


def _make_restaurant(*, username, name, pos_enabled=True):
    owner = User.objects.create_user(
        username=username,
        password='pass12345',
        role=UserRole.RESTAURANT,
    )
    restaurant = Restaurant.objects.create(
        owner=owner,
        name=name,
        address='Calle 1',
        latitude=Decimal('19.860273'),
        longitude=Decimal('-100.828562'),
        is_active=True,
        accepting_orders=True,
        pos_enabled=pos_enabled,
    )
    return owner, restaurant


class PosAccessTests(TestCase):
    def setUp(self):
        self.owner_a, self.rest_a = _make_restaurant(username='owner_a', name='Rest A')
        self.owner_b, self.rest_b = _make_restaurant(username='owner_b', name='Rest B')
        self.cashier_a = User.objects.create_user(
            username='cashier_a',
            password='pass12345',
            role=UserRole.CUSTOMER,
        )
        POSStaffMembership.objects.create(
            user=self.cashier_a,
            restaurant=self.rest_a,
            role=POSStaffRole.CASHIER,
            is_active=True,
        )
        self.outsider = User.objects.create_user(
            username='outsider',
            password='pass12345',
            role=UserRole.CUSTOMER,
        )
        self.product_a = Product.objects.create(
            restaurant=self.rest_a,
            name='Taco A',
            price=Decimal('50.00'),
            category=ProductCategory.COMIDA,
            is_available=True,
        )
        self.product_b = Product.objects.create(
            restaurant=self.rest_b,
            name='Taco B',
            price=Decimal('60.00'),
            category=ProductCategory.COMIDA,
            is_available=True,
        )
        self.client = Client()

    def _login_cashier(self):
        assert self.client.login(username='cashier_a', password='pass12345')
        session = self.client.session
        session[SESSION_RESTAURANT_KEY] = self.rest_a.id
        session.save()

    def test_outsider_cannot_access_pos(self):
        self.client.login(username='outsider', password='pass12345')
        response = self.client.get(reverse('pos:dashboard'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/pos/login/', response.url)

    def test_login_clears_non_pos_session_then_allows_owner(self):
        """Evita 403 CSRF al llegar logueado desde panel sin acceso POS."""
        admin = User.objects.create_user(
            username='panel_admin_pos',
            password='pass12345',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client.login(username='panel_admin_pos', password='pass12345')
        first = self.client.get(reverse('pos:login'))
        self.assertEqual(first.status_code, 302)
        self.assertEqual(first.url, reverse('pos:login'))

        page = self.client.get(reverse('pos:login'))
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, 'csrfmiddlewaretoken')

        response = self.client.post(
            reverse('pos:login'),
            {'username': 'owner_a', 'password': 'pass12345'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn('/pos/', response.url)

    def test_pos_disabled_blocks_owner(self):
        self.rest_a.pos_enabled = False
        self.rest_a.save(update_fields=['pos_enabled'])
        self.assertEqual(accessible_restaurants_qs(self.owner_a).count(), 0)

    def test_cashier_cannot_open_ticket_other_restaurant(self):
        open_cash_session(
            restaurant=self.rest_b,
            user=self.owner_b,
            cash_register_id=None,
            opening_amount=Decimal('100.00'),
        )
        order_b = create_pos_sale(
            restaurant=self.rest_b,
            user=self.owner_b,
            items=[{'product_id': self.product_b.id, 'quantity': 1}],
            payment_method=PaymentMethod.CASH,
            amount_received=Decimal('60.00'),
            idempotency_key='ticket-b-1',
        )
        self._login_cashier()
        response = self.client.get(reverse('pos:ticket', kwargs={'order_id': order_b.id}))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('pos:dashboard'))

    def test_cashier_cannot_sell_product_other_restaurant(self):
        open_cash_session(
            restaurant=self.rest_a,
            user=self.cashier_a,
            cash_register_id=None,
            opening_amount=Decimal('0'),
        )
        with self.assertRaises(PosError):
            create_pos_sale(
                restaurant=self.rest_a,
                user=self.cashier_a,
                items=[{'product_id': self.product_b.id, 'quantity': 1}],
                payment_method=PaymentMethod.CARD,
                idempotency_key='cross-product',
            )

    def test_cashier_cannot_see_other_restaurant_cash_session(self):
        from pos.selectors.cash import session_for_restaurant

        session_b = open_cash_session(
            restaurant=self.rest_b,
            user=self.owner_b,
            cash_register_id=None,
            opening_amount=Decimal('10'),
        )
        self.assertIsNone(
            session_for_restaurant(restaurant=self.rest_a, session_id=session_b.id)
        )


class PosSaleServiceTests(TestCase):
    def setUp(self):
        self.owner, self.restaurant = _make_restaurant(username='pos_owner', name='POS Rest')
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Burger',
            price=Decimal('100.00'),
            category=ProductCategory.COMIDA,
            is_available=True,
        )

    def test_cash_requires_open_session(self):
        with self.assertRaises(PosError):
            create_pos_sale(
                restaurant=self.restaurant,
                user=self.owner,
                items=[{'product_id': self.product.id, 'quantity': 1}],
                payment_method=PaymentMethod.CASH,
                amount_received=Decimal('100'),
                idempotency_key='no-cash',
            )

    def test_cash_sale_creates_movement_for_total_not_received(self):
        open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('50'),
        )
        order = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 1}],
            payment_method=PaymentMethod.CASH,
            amount_received=Decimal('200'),
            idempotency_key='cash-1',
        )
        self.assertEqual(order.source, OrderSource.POS)
        self.assertIsNone(order.customer_id)
        self.assertEqual(order.delivery_fee, Decimal('0.00'))
        self.assertEqual(order.total, Decimal('100.00'))
        self.assertEqual(order.pos_sale.change_given, Decimal('100.00'))
        movement = CashMovement.objects.get(order=order, type=CashMovementType.SALE)
        self.assertEqual(movement.amount, Decimal('100.00'))

    def test_idempotency_prevents_duplicate_sale(self):
        open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('0'),
        )
        first = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 1}],
            payment_method=PaymentMethod.CASH,
            amount_received=Decimal('100'),
            idempotency_key='idem-1',
        )
        second = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 1}],
            payment_method=PaymentMethod.CASH,
            amount_received=Decimal('100'),
            idempotency_key='idem-1',
        )
        self.assertEqual(first.id, second.id)
        self.assertEqual(Order.objects.filter(source=OrderSource.POS).count(), 1)

    def test_ignores_client_prices(self):
        order = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{
                'product_id': self.product.id,
                'quantity': 2,
                'unit_price': '1.00',
            }],
            payment_method=PaymentMethod.CARD,
            idempotency_key='price-hack',
        )
        self.assertEqual(order.total, Decimal('200.00'))


class PosRegressionSourceTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.customer = User.objects.create_user(
            username='cust1',
            password='pass12345',
            role=UserRole.CUSTOMER,
        )
        self.owner, self.restaurant = _make_restaurant(username='reg_owner', name='Reg Rest')
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Pizza',
            price=Decimal('80.00'),
            category=ProductCategory.COMIDA,
            is_available=True,
        )

    @override_settings(DEBUG=True)
    def test_api_order_gets_source_zinapp(self):
        self.api.force_authenticate(self.customer)
        response = self.api.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Av Siempre Viva 123, Zinapecuaro',
            'delivery_latitude': '19.860273',
            'delivery_longitude': '-100.828562',
            'payment_method': 'cash',
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(pk=response.data['id'])
        self.assertEqual(order.source, OrderSource.ZINAPP)
        self.assertEqual(order.customer_id, self.customer.id)
        self.assertTrue(order.delivery_address)

    def test_notify_and_broadcast_tolerate_pos_order_without_customer(self):
        order = Order.objects.create(
            customer=None,
            restaurant=self.restaurant,
            source=OrderSource.POS,
            created_by=self.owner,
            status=OrderStatus.PREPARING,
            payment_method=PaymentMethod.CARD,
            payment_status=PaymentStatus.PAID,
            delivery_address='',
            delivery_fee=Decimal('0.00'),
            subtotal=Decimal('10.00'),
            total=Decimal('10.00'),
        )
        broadcast_order_updated(order)
        notify_order_status(order, previous_status=OrderStatus.PENDING)
        self.assertTrue(notify_review_reminder(order))

    def test_driver_available_excludes_pos_orders(self):
        from accounts.models import DeliveryProfile

        driver = User.objects.create_user(
            username='driver1',
            password='pass12345',
            role=UserRole.DRIVER,
        )
        DeliveryProfile.objects.create(
            user=driver,
            is_available=True,
            verification_status='approved',
        )
        Order.objects.create(
            customer=None,
            restaurant=self.restaurant,
            source=OrderSource.POS,
            status=OrderStatus.READY,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            delivery_address='',
            delivery_fee=Decimal('0.00'),
            total=Decimal('10.00'),
        )
        Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            source=OrderSource.ZINAPP,
            status=OrderStatus.READY,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            delivery_address='Calle X',
            total=Decimal('80.00'),
        )
        self.api.force_authenticate(driver)
        response = self.api.get('/api/orders/available/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            Order.objects.get(pk=response.data[0]['id']).source,
            OrderSource.ZINAPP,
        )

class PosOrdersPhase2Tests(TestCase):
    def setUp(self):
        self.owner_a, self.rest_a = _make_restaurant(username='ord_owner_a', name='Ord A')
        self.owner_b, self.rest_b = _make_restaurant(username='ord_owner_b', name='Ord B')
        self.cashier = User.objects.create_user(
            username='ord_cashier',
            password='pass12345',
            role=UserRole.CUSTOMER,
        )
        POSStaffMembership.objects.create(
            user=self.cashier,
            restaurant=self.rest_a,
            role=POSStaffRole.CASHIER,
            is_active=True,
        )
        self.kitchen = User.objects.create_user(
            username='ord_kitchen',
            password='pass12345',
            role=UserRole.CUSTOMER,
        )
        POSStaffMembership.objects.create(
            user=self.kitchen,
            restaurant=self.rest_a,
            role=POSStaffRole.KITCHEN,
            is_active=True,
        )
        self.customer = User.objects.create_user(
            username='ord_customer',
            password='pass12345',
            role=UserRole.CUSTOMER,
        )
        self.order_a = Order.objects.create(
            customer=self.customer,
            restaurant=self.rest_a,
            source=OrderSource.ZINAPP,
            status=OrderStatus.PENDING,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            delivery_address='Calle A',
            total=Decimal('50.00'),
        )
        self.order_b = Order.objects.create(
            customer=self.customer,
            restaurant=self.rest_b,
            source=OrderSource.ZINAPP,
            status=OrderStatus.PENDING,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            delivery_address='Calle B',
            total=Decimal('60.00'),
        )
        self.client = Client()

    def _login(self, username, restaurant):
        assert self.client.login(username=username, password='pass12345')
        session = self.client.session
        session[SESSION_RESTAURANT_KEY] = restaurant.id
        session.save()

    def test_cashier_sees_only_own_restaurant_orders(self):
        self._login('ord_cashier', self.rest_a)
        response = self.client.get(reverse('pos:orders'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertIn(self.order_a.display_ref, content)
        self.assertNotIn(self.order_b.code or str(self.order_b.id), content)

    def test_cashier_cannot_accept_other_restaurant_order(self):
        from pos.services.orders import accept_order
        self._login('ord_cashier', self.rest_a)
        with self.assertRaises(PosError):
            accept_order(restaurant=self.rest_a, order_id=self.order_b.id)

    def test_accept_and_ready_flow(self):
        from pos.services.orders import accept_order, set_order_status
        order = accept_order(restaurant=self.rest_a, order_id=self.order_a.id, prep_minutes=15)
        self.assertEqual(order.status, OrderStatus.PREPARING)
        order = set_order_status(
            restaurant=self.rest_a,
            order_id=order.id,
            new_status=OrderStatus.READY,
        )
        self.assertEqual(order.status, OrderStatus.READY)

    def test_kitchen_can_access_kitchen_view(self):
        self._login('ord_kitchen', self.rest_a)
        response = self.client.get(reverse('pos:kitchen'))
        self.assertEqual(response.status_code, 200)

    def test_cashier_cannot_access_kitchen(self):
        self._login('ord_cashier', self.rest_a)
        response = self.client.get(reverse('pos:kitchen'))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('pos:dashboard'))

    def test_cross_restaurant_action_post_rejected(self):
        self._login('ord_cashier', self.rest_a)
        response = self.client.post(
            reverse('pos:order_action', kwargs={'order_id': self.order_b.id}),
            {'action': 'accept', 'prep_minutes': 15},
        )
        self.assertEqual(response.status_code, 302)
        self.order_b.refresh_from_db()
        self.assertEqual(self.order_b.status, OrderStatus.PENDING)

    def test_ws_ticket_for_pos_session(self):
        self._login('ord_cashier', self.rest_a)
        response = self.client.post(reverse('pos:ws_ticket'))
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn('ticket', data)
        self.assertEqual(data['restaurant_id'], self.rest_a.id)

    def test_pos_order_complete_from_ready(self):
        from pos.services.orders import set_order_status
        pos_order = Order.objects.create(
            customer=None,
            restaurant=self.rest_a,
            source=OrderSource.POS,
            created_by=self.owner_a,
            status=OrderStatus.READY,
            payment_method=PaymentMethod.CARD,
            payment_status=PaymentStatus.PAID,
            delivery_address='',
            delivery_fee=Decimal('0.00'),
            total=Decimal('30.00'),
        )
        done = set_order_status(
            restaurant=self.rest_a,
            order_id=pos_order.id,
            new_status=OrderStatus.DELIVERED,
        )
        self.assertEqual(done.status, OrderStatus.DELIVERED)

class PosPhase3Tests(TestCase):
    def setUp(self):
        self.owner, self.restaurant = _make_restaurant(username='p3_owner', name='P3 Rest')
        self.owner_b, self.rest_b = _make_restaurant(username='p3_owner_b', name='P3 Rest B')
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Soup',
            price=Decimal('80.00'),
            category=ProductCategory.COMIDA,
            is_available=True,
        )
        self.client = Client()

    def _login_owner(self, restaurant=None):
        restaurant = restaurant or self.restaurant
        assert self.client.login(username=restaurant.owner.username, password='pass12345')
        session = self.client.session
        session[SESSION_RESTAURANT_KEY] = restaurant.id
        session.save()

    def test_cancel_cash_sale_reverses_movement(self):
        from pos.services.cancellations import cancel_pos_sale
        from pos.services.cash import compute_expected_cash

        session = open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('100.00'),
        )
        order = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 1}],
            payment_method=PaymentMethod.CASH,
            amount_received=Decimal('100'),
            idempotency_key='p3-cash-1',
        )
        self.assertEqual(compute_expected_cash(session), Decimal('180.00'))
        cancel_pos_sale(
            restaurant=self.restaurant,
            order_id=order.id,
            user=self.owner,
            reason='Cobro duplicado',
        )
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.CANCELLED)
        self.assertTrue(order.pos_sale.cancelled_at)
        self.assertEqual(order.pos_sale.cancel_reason, 'Cobro duplicado')
        self.assertEqual(compute_expected_cash(session), Decimal('100.00'))
        self.assertEqual(
            CashMovement.objects.filter(order=order, type=CashMovementType.CANCELLATION).count(),
            1,
        )

    def test_cancel_other_restaurant_rejected(self):
        from pos.services.cancellations import cancel_pos_sale

        open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('0'),
        )
        order = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 1}],
            payment_method=PaymentMethod.CARD,
            idempotency_key='p3-card-1',
        )
        with self.assertRaises(PosError):
            cancel_pos_sale(
                restaurant=self.rest_b,
                order_id=order.id,
                user=self.owner_b,
                reason='Intento cruzado',
            )

    def test_double_cancel_rejected(self):
        from pos.services.cancellations import cancel_pos_sale

        open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('0'),
        )
        order = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 1}],
            payment_method=PaymentMethod.CARD,
            idempotency_key='p3-card-2',
        )
        cancel_pos_sale(
            restaurant=self.restaurant,
            order_id=order.id,
            user=self.owner,
            reason='Primera',
        )
        with self.assertRaises(PosError):
            cancel_pos_sale(
                restaurant=self.restaurant,
                order_id=order.id,
                user=self.owner,
                reason='Segunda',
            )

    def test_cash_cut_page(self):
        open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('50'),
        )
        self._login_owner()
        response = self.client.get(reverse('pos:cash_cut'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Efectivo esperado')

    def test_reports_page_owner(self):
        self._login_owner()
        response = self.client.get(reverse('pos:reports'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Ticket promedio')

    def test_reports_isolation(self):
        self._login_owner(self.rest_b)
        # Owner B cannot see restaurant A reports via session switch alone;
        # feed is always filtered by session restaurant.
        from pos.services.reports import build_daily_reports
        report_a = build_daily_reports(self.restaurant)
        report_b = build_daily_reports(self.rest_b)
        self.assertEqual(report_a['sales_count'], 0)
        self.assertEqual(report_b['sales_count'], 0)

class PosPhase4InventoryTests(TestCase):
    def setUp(self):
        self.owner, self.restaurant = _make_restaurant(username='p4_owner', name='P4 Rest')
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Agua',
            price=Decimal('20.00'),
            category=ProductCategory.BEBIDAS,
            is_available=True,
            track_inventory=True,
            stock_quantity=2,
        )

    def test_sale_decrements_stock(self):
        open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('0'),
        )
        create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 1}],
            payment_method=PaymentMethod.CASH,
            amount_received=Decimal('20'),
            idempotency_key='p4-stock-1',
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 1)

    def test_sale_blocked_without_stock(self):
        self.product.stock_quantity = 0
        self.product.save(update_fields=['stock_quantity'])
        with self.assertRaises(PosError):
            create_pos_sale(
                restaurant=self.restaurant,
                user=self.owner,
                items=[{'product_id': self.product.id, 'quantity': 1}],
                payment_method=PaymentMethod.CARD,
                idempotency_key='p4-stock-0',
            )

    def test_cancel_restores_stock(self):
        from pos.services.cancellations import cancel_pos_sale

        open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('0'),
        )
        order = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 2}],
            payment_method=PaymentMethod.CASH,
            amount_received=Decimal('40'),
            idempotency_key='p4-stock-restore',
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 0)
        cancel_pos_sale(
            restaurant=self.restaurant,
            order_id=order.id,
            user=self.owner,
            reason='Error de stock',
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 2)

    def test_kitchen_ticket_isolated(self):
        client = Client()
        owner_b, rest_b = _make_restaurant(username='p4_owner_b', name='P4 B')
        open_cash_session(
            restaurant=self.restaurant,
            user=self.owner,
            cash_register_id=None,
            opening_amount=Decimal('0'),
        )
        order = create_pos_sale(
            restaurant=self.restaurant,
            user=self.owner,
            items=[{'product_id': self.product.id, 'quantity': 1}],
            payment_method=PaymentMethod.CARD,
            idempotency_key='p4-ticket',
        )
        assert client.login(username='p4_owner_b', password='pass12345')
        session = client.session
        session[SESSION_RESTAURANT_KEY] = rest_b.id
        session.save()
        response = client.get(reverse('pos:ticket_kitchen', kwargs={'order_id': order.id}))
        self.assertEqual(response.status_code, 302)

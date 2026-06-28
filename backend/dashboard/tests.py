from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from accounts.models import UserRole
from orders.models import DisputeStatus, Order, OrderDispute, OrderStatus

User = get_user_model()


class PanelAccessTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='panel_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='panel_cliente',
            password='clientepass123',
            role=UserRole.CUSTOMER,
        )

    def test_anonymous_user_sees_login(self):
        response = self.client.get('/panel/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/panel/login/', response['Location'])

    def test_admin_can_access_panel(self):
        self.client.login(username='panel_admin', password='adminpass123')
        response = self.client.get('/panel/')
        self.assertEqual(response.status_code, 200)

    def test_customer_is_redirected_to_login_not_403(self):
        self.client.login(username='panel_cliente', password='clientepass123')
        response = self.client.get('/panel/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/panel/login/', response['Location'])

    def test_customer_cannot_login_to_panel(self):
        response = self.client.post(
            '/panel/login/',
            {'username': 'panel_cliente', 'password': 'clientepass123'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'no tiene acceso al panel')

    def test_admin_role_without_staff_flag_can_access(self):
        admin = User.objects.create_user(
            username='role_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=False,
        )
        self.client.login(username='role_admin', password='adminpass123')
        response = self.client.get('/panel/')
        self.assertEqual(response.status_code, 200)
        admin.delete()


class DisputePanelTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='dispute_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        from restaurants.models import Restaurant
        from decimal import Decimal

        self.customer = User.objects.create_user(
            username='dispute_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
        )
        self.restaurant_owner = User.objects.create_user(
            username='dispute_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.restaurant_owner,
            name='Test Local',
            category='comida',
            address='Calle 1',
            phone='123',
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.DELIVERED,
            delivery_address='Calle 2',
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('20.00'),
            total=Decimal('120.00'),
        )
        self.dispute = OrderDispute.objects.create(
            order=self.order,
            customer=self.customer,
            reason='Pedido incompleto',
            requested_amount=Decimal('50.00'),
            status=DisputeStatus.PENDING,
        )

    def test_admin_can_list_disputes(self):
        self.client.login(username='dispute_admin', password='adminpass123')
        response = self.client.get('/panel/gestion/disputas/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'dispute_customer')
        self.assertContains(response, 'Revisar')

    def test_admin_can_resolve_dispute(self):
        self.client.login(username='dispute_admin', password='adminpass123')
        response = self.client.post(
            f'/panel/gestion/disputas/{self.dispute.pk}/',
            {'status': 'approved', 'admin_notes': 'Aprobado parcial'},
        )
        self.assertEqual(response.status_code, 302)
        self.dispute.refresh_from_db()
        self.assertEqual(self.dispute.status, DisputeStatus.APPROVED)
        self.assertIsNotNone(self.dispute.resolved_at)

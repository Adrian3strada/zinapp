from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from accounts.models import UserRole

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

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client, TestCase
from rest_framework.test import APIClient

from accounts.models import DeliveryProfile, UserRole
from dashboard.gestion.forms import UserCreateForm

User = get_user_model()


class PanelUserLoginTests(TestCase):
    def test_panel_user_password_is_usable(self):
        form = UserCreateForm(
            data={
                'username': 'panel_pwd',
                'password1': 'clave12345',
                'password2': 'clave12345',
                'role': 'customer',
            },
        )
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertTrue(user.has_usable_password())
        self.assertTrue(user.check_password('clave12345'))

    def test_panel_user_with_mixed_case_username_can_login(self):
        form = UserCreateForm(
            data={
                'username': 'Gael',
                'password1': 'clave12345',
                'password2': 'clave12345',
                'role': 'driver',
                'first_name': 'Gael',
                'last_name': 'Test',
            },
        )
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertEqual(user.username, 'gael')

        client = APIClient()
        response = client.post(
            '/api/auth/login/',
            {'username': 'Gael', 'password': 'clave12345'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn('access', response.data)

    def test_panel_restaurant_user_gets_restaurant_record(self):
        form = UserCreateForm(
            data={
                'username': 'nuevo_rest',
                'password1': 'clave12345',
                'password2': 'clave12345',
                'role': 'restaurant',
                'first_name': 'Dueño',
                'phone': '4511234567',
                'restaurant_name': 'Tacos Test',
                'restaurant_address': 'Av Hidalgo, Zinapécuaro',
            },
        )
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertTrue(user.restaurants.exists())

    def test_plaintext_password_is_repaired_and_login_works(self):
        user = User.objects.create_user(
            username='panel_legacy',
            password='ignored',
            role='customer',
        )
        User.objects.filter(pk=user.pk).update(password='legacy12345')
        user.refresh_from_db()
        self.assertFalse(user.check_password('legacy12345'))

        call_command('fix_password_hashes')

        user.refresh_from_db()
        self.assertTrue(user.check_password('legacy12345'))

        client = APIClient()
        response = client.post(
            '/api/auth/login/',
            {'username': 'panel_legacy', 'password': 'legacy12345'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)


class DeliveryProfileApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.driver = User.objects.create_user(
            username='kike',
            password='test1234',
            role='driver',
        )
        DeliveryProfile.objects.create(user=self.driver, is_available=False)

    def test_driver_can_toggle_availability_via_me(self):
        self.client.force_authenticate(self.driver)
        response = self.client.patch(
            '/api/auth/delivery-profiles/me/',
            {'is_available': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_available'])

    def test_driver_can_read_own_profile_via_me(self):
        self.client.force_authenticate(self.driver)
        response = self.client.get('/api/auth/delivery-profiles/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['id'], self.driver.id)


class UserEditPasswordTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='pwd_edit_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username='gael11',
            password='oldpass12345',
            role=UserRole.CUSTOMER,
        )

    def test_password_change_keeps_user_active_without_checkbox(self):
        self.client.login(username='pwd_edit_admin', password='adminpass123')
        response = self.client.post(
            f'/panel/gestion/usuarios/{self.user.pk}/',
            {
                'username': 'gael11',
                'email': '',
                'first_name': '',
                'last_name': '',
                'role': 'customer',
                'phone': '',
                'address': '',
                'new_password1': 'newpass12345',
                'new_password2': 'newpass12345',
            },
        )
        self.assertEqual(response.status_code, 302)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertTrue(self.user.check_password('newpass12345'))

        api = APIClient()
        login = api.post(
            '/api/auth/login/',
            {'username': 'Gael11', 'password': 'newpass12345'},
            format='json',
        )
        self.assertEqual(login.status_code, 200, login.data)


class DeleteAccountApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='delete_me',
            password='clave12345',
            role=UserRole.CUSTOMER,
            email='deleteme@test.com',
            phone='4431000099',
            first_name='Bye',
            last_name='User',
            address='Calle Test 1',
        )

    def test_delete_account_anonymizes_and_blocks_login(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': 'delete_me', 'password': 'clave12345'},
            format='json',
        )
        self.assertEqual(login.status_code, 200, login.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        response = self.client.post(
            '/api/auth/delete-account/',
            {'password': 'clave12345', 'confirmation': 'ELIMINAR'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertTrue(self.user.username.startswith('deleted_'))
        self.assertEqual(self.user.email, '')
        self.assertEqual(self.user.phone, '')
        self.assertFalse(self.user.has_usable_password())

        blocked = APIClient().post(
            '/api/auth/login/',
            {'username': 'delete_me', 'password': 'clave12345'},
            format='json',
        )
        self.assertEqual(blocked.status_code, 401)

    def test_delete_account_requires_password(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': 'delete_me', 'password': 'clave12345'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.post(
            '/api/auth/delete-account/',
            {'password': 'wrong', 'confirmation': 'ELIMINAR'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertEqual(self.user.username, 'delete_me')

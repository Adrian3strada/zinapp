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


class RestaurantCrudPanelTests(TestCase):
    def setUp(self):
        from restaurants.models import Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='restaurant_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.owner = User.objects.create_user(
            username='restaurant_owner',
            password='ownerpass123',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Local sin pedidos',
            address='Calle Principal 1',
        )
        self.client.login(username='restaurant_admin', password='adminpass123')

    def test_admin_can_open_restaurant_crud_views(self):
        list_response = self.client.get('/panel/restaurantes/')
        create_response = self.client.get('/panel/gestion/restaurantes/nuevo/')
        edit_response = self.client.get(f'/panel/gestion/restaurantes/{self.restaurant.pk}/')
        delete_response = self.client.get(
            f'/panel/gestion/restaurantes/{self.restaurant.pk}/eliminar/'
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertContains(list_response, 'Nuevo restaurante')
        self.assertEqual(create_response.status_code, 200)
        self.assertEqual(edit_response.status_code, 200)
        self.assertEqual(delete_response.status_code, 200)
        self.assertContains(delete_response, 'Sí, eliminar restaurante')

    def test_admin_can_delete_restaurant_without_orders(self):
        response = self.client.post(
            f'/panel/gestion/restaurantes/{self.restaurant.pk}/eliminar/'
        )

        self.assertRedirects(response, '/panel/restaurantes/')
        self.assertFalse(
            self.restaurant.__class__.objects.filter(pk=self.restaurant.pk).exists()
        )

    def test_admin_cannot_delete_restaurant_with_orders(self):
        from decimal import Decimal

        customer = User.objects.create_user(
            username='restaurant_customer',
            password='customerpass123',
            role=UserRole.CUSTOMER,
        )
        Order.objects.create(
            customer=customer,
            restaurant=self.restaurant,
            status=OrderStatus.PENDING,
            delivery_address='Calle del cliente 2',
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('20.00'),
            total=Decimal('120.00'),
        )

        response = self.client.post(
            f'/panel/gestion/restaurantes/{self.restaurant.pk}/eliminar/',
            follow=True,
        )

        self.assertTrue(
            self.restaurant.__class__.objects.filter(pk=self.restaurant.pk).exists()
        )
        self.assertContains(response, 'No se puede eliminar')


class UserAndDriverCrudPanelTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='user_crud_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client.login(username='user_crud_admin', password='adminpass123')

    def test_admin_can_create_driver_from_driver_list(self):
        from accounts.models import DeliveryProfile

        response = self.client.post(
            '/panel/gestion/usuarios/nuevo/?role=driver',
            {
                'username': 'nuevo_repartidor',
                'email': '',
                'first_name': 'Nuevo',
                'last_name': 'Repartidor',
                'role': UserRole.DRIVER,
                'phone': '4430000000',
                'password1': 'DriverPass123!',
                'password2': 'DriverPass123!',
                'vehicle_type': DeliveryProfile.VehicleType.MOTORCYCLE,
                'license_plate': 'ABC123',
            },
        )

        driver = User.objects.get(username='nuevo_repartidor')
        self.assertRedirects(response, '/panel/repartidores/')
        self.assertTrue(DeliveryProfile.objects.filter(user=driver).exists())

    def test_admin_can_delete_user_without_operational_history(self):
        user = User.objects.create_user(
            username='user_without_history',
            password='userpass123',
            role=UserRole.CUSTOMER,
        )

        response = self.client.post(f'/panel/gestion/usuarios/{user.pk}/eliminar/')

        self.assertRedirects(response, '/panel/usuarios/')
        self.assertFalse(User.objects.filter(pk=user.pk).exists())

    def test_admin_cannot_delete_driver_with_delivery_history(self):
        from decimal import Decimal
        from restaurants.models import Restaurant

        owner = User.objects.create_user(
            username='driver_history_owner',
            password='ownerpass123',
            role=UserRole.RESTAURANT,
        )
        customer = User.objects.create_user(
            username='driver_history_customer',
            password='customerpass123',
            role=UserRole.CUSTOMER,
        )
        driver = User.objects.create_user(
            username='driver_with_history',
            password='driverpass123',
            role=UserRole.DRIVER,
        )
        restaurant = Restaurant.objects.create(
            owner=owner,
            name='Local del repartidor',
            address='Calle 3',
        )
        Order.objects.create(
            customer=customer,
            restaurant=restaurant,
            driver=driver,
            status=OrderStatus.PENDING,
            delivery_address='Calle 4',
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('20.00'),
            total=Decimal('120.00'),
        )

        response = self.client.post(
            f'/panel/gestion/usuarios/{driver.pk}/eliminar/',
            follow=True,
        )

        self.assertTrue(User.objects.filter(pk=driver.pk).exists())
        self.assertContains(response, 'No se puede eliminar')

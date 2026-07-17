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

        driver.refresh_from_db()
        self.assertTrue(User.objects.filter(pk=driver.pk).exists())
        self.assertFalse(driver.is_active)
        self.assertContains(response, 'desactivado')


class PromotionCrudPanelTests(TestCase):
    def setUp(self):
        from datetime import timedelta
        from decimal import Decimal

        from django.utils import timezone
        from restaurants.models import Product, PromoType, Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='promo_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.owner = User.objects.create_user(
            username='promo_owner',
            password='ownerpass123',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Promo Local',
            address='Centro',
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('30.00'),
            is_available=True,
        )
        self.PromoType = PromoType
        self.timezone = timezone
        self.timedelta = timedelta
        self.Decimal = Decimal
        self.client.login(username='promo_admin', password='adminpass123')

    def test_admin_can_create_promotion(self):
        from accounts.models import AuditLog
        from restaurants.models import ProductPromotion

        response = self.client.post(
            '/panel/gestion/promociones/nueva/',
            {
                'product': self.product.pk,
                'promo_type': self.PromoType.PERCENT_OFF,
                'percent_off': 20,
                'special_price': '',
                'label': 'Promo taco',
                'valid_until': (self.timezone.now() + self.timedelta(days=2)).strftime('%Y-%m-%dT%H:%M'),
                'is_active': 'on',
            },
        )
        self.assertEqual(response.status_code, 302)
        promo = ProductPromotion.objects.get(product=self.product, is_active=True)
        self.assertEqual(promo.percent_off, 20)
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.PANEL_ENTITY_UPDATED,
                object_type='ProductPromotion',
                object_id=str(promo.pk),
            ).exists()
        )

    def test_creating_active_promo_deactivates_previous(self):
        from restaurants.models import ProductPromotion

        old = ProductPromotion.objects.create(
            restaurant=self.restaurant,
            product=self.product,
            promo_type=self.PromoType.PERCENT_OFF,
            percent_off=10,
            valid_until=self.timezone.now() + self.timedelta(days=1),
            is_active=True,
        )
        response = self.client.post(
            '/panel/gestion/promociones/nueva/',
            {
                'product': self.product.pk,
                'promo_type': self.PromoType.TWO_FOR_ONE,
                'percent_off': '',
                'special_price': '',
                'label': '2x1',
                'valid_until': (self.timezone.now() + self.timedelta(days=3)).strftime('%Y-%m-%dT%H:%M'),
                'is_active': 'on',
            },
        )
        self.assertEqual(response.status_code, 302)
        old.refresh_from_db()
        self.assertFalse(old.is_active)
        self.assertEqual(ProductPromotion.objects.filter(product=self.product, is_active=True).count(), 1)


class ProductSafeDeletePanelTests(TestCase):
    def setUp(self):
        from decimal import Decimal
        from restaurants.models import Product, Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='product_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.owner = User.objects.create_user(
            username='product_owner',
            password='ownerpass123',
            role=UserRole.RESTAURANT,
        )
        self.customer = User.objects.create_user(
            username='product_customer',
            password='customerpass123',
            role=UserRole.CUSTOMER,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Menú Local',
            address='Calle 1',
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Quesadilla',
            price=Decimal('40.00'),
            is_available=True,
        )
        self.Decimal = Decimal
        self.client.login(username='product_admin', password='adminpass123')

    def test_product_with_order_history_is_deactivated(self):
        from accounts.models import AuditLog
        from orders.models import OrderItem

        order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.PENDING,
            delivery_address='Calle 2',
            subtotal=self.Decimal('40.00'),
            delivery_fee=self.Decimal('20.00'),
            total=self.Decimal('60.00'),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=1,
            unit_price=self.Decimal('40.00'),
        )

        response = self.client.post(
            f'/panel/gestion/productos/{self.product.pk}/eliminar/',
            follow=True,
        )
        self.product.refresh_from_db()
        self.assertTrue(self.product.__class__.objects.filter(pk=self.product.pk).exists())
        self.assertFalse(self.product.is_available)
        self.assertContains(response, 'desactivado')
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.PANEL_ENTITY_DEACTIVATED,
                object_type='Product',
                object_id=str(self.product.pk),
            ).exists()
        )


class LocalServicePanelTests(TestCase):
    def setUp(self):
        from local_services.models import LocalService, LocalServiceCategory

        self.client = Client()
        self.admin = User.objects.create_user(
            username='service_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.service = LocalService.objects.create(
            name='Barbería Centro',
            category=LocalServiceCategory.BEAUTY,
            description='Cortes',
            is_active=True,
        )
        self.client.login(username='service_admin', password='adminpass123')

    def test_admin_can_deactivate_and_delete_service(self):
        deactivate = self.client.post(
            f'/panel/gestion/servicios/{self.service.pk}/desactivar/',
            follow=True,
        )
        self.service.refresh_from_db()
        self.assertFalse(self.service.is_active)
        self.assertContains(deactivate, 'oculto')

        delete_active = self.client.post(
            f'/panel/gestion/servicios/{self.service.pk}/eliminar/',
            follow=True,
        )
        # Already inactive: hard delete allowed.
        self.assertFalse(self.service.__class__.objects.filter(pk=self.service.pk).exists())
        self.assertContains(delete_active, 'eliminado')


class OrderShipmentDisputePanelTests(TestCase):
    def setUp(self):
        from decimal import Decimal
        from restaurants.models import Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='ops_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='ops_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
        )
        self.driver = User.objects.create_user(
            username='ops_driver',
            password='pass123',
            role=UserRole.DRIVER,
        )
        self.owner = User.objects.create_user(
            username='ops_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Ops Local',
            address='Calle Ops',
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.READY,
            delivery_address='Entrega 1',
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('20.00'),
            total=Decimal('120.00'),
        )
        self.Decimal = Decimal
        self.client.login(username='ops_admin', password='adminpass123')

    def test_order_edit_validates_transitions_and_audits(self):
        from accounts.models import AuditLog

        bad = self.client.post(
            f'/panel/gestion/pedidos/{self.order.pk}/editar/',
            {'status': OrderStatus.DELIVERED, 'driver': ''},
        )
        self.assertEqual(bad.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.READY)

        ok = self.client.post(
            f'/panel/gestion/pedidos/{self.order.pk}/editar/',
            {'status': OrderStatus.ON_THE_WAY, 'driver': self.driver.pk},
        )
        self.assertEqual(ok.status_code, 302)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.ON_THE_WAY)
        self.assertEqual(self.order.driver_id, self.driver.pk)
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.ORDER_STATUS_UPDATED,
                object_type='Order',
                object_id=str(self.order.pk),
            ).exists()
        )

    def test_shipment_edit_requires_driver_and_audits(self):
        from accounts.models import AuditLog
        from orders.models import Shipment, ShipmentStatus

        shipment = Shipment.objects.create(
            customer=self.customer,
            status=ShipmentStatus.PENDING,
            description='Paquete',
            pickup_address='A',
            delivery_address='B',
            delivery_fee=self.Decimal('25.00'),
            total=self.Decimal('25.00'),
        )
        bad = self.client.post(
            f'/panel/gestion/envios/{shipment.pk}/',
            {'status': ShipmentStatus.PICKED_UP, 'driver': ''},
        )
        self.assertEqual(bad.status_code, 200)
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.PENDING)

        ok = self.client.post(
            f'/panel/gestion/envios/{shipment.pk}/',
            {'status': ShipmentStatus.PICKED_UP, 'driver': self.driver.pk},
        )
        self.assertEqual(ok.status_code, 302)
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.PICKED_UP)
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.SHIPMENT_STATUS_UPDATED,
                object_type='Shipment',
                object_id=str(shipment.pk),
            ).exists()
        )

    def test_dispute_refund_does_not_force_payment_paid(self):
        from accounts.models import AuditLog
        from orders.models import PaymentStatus

        self.order.status = OrderStatus.DELIVERED
        self.order.payment_status = PaymentStatus.PAID
        self.order.save(update_fields=['status', 'payment_status', 'updated_at'])
        dispute = OrderDispute.objects.create(
            order=self.order,
            customer=self.customer,
            reason='Incompleto',
            requested_amount=self.Decimal('50.00'),
            status=DisputeStatus.PENDING,
        )

        response = self.client.post(
            f'/panel/gestion/disputas/{dispute.pk}/',
            {'status': DisputeStatus.REFUNDED, 'admin_notes': 'Reembolso manual'},
            follow=True,
        )
        dispute.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(dispute.status, DisputeStatus.REFUNDED)
        self.assertIsNotNone(dispute.resolved_at)
        self.assertEqual(self.order.payment_status, PaymentStatus.PAID)
        self.assertContains(response, 'reembolsada')
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.DISPUTE_UPDATED,
                object_type='OrderDispute',
                object_id=str(dispute.pk),
            ).exists()
        )


class PanelTechnicalConsoleTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='console_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client.login(username='console_admin', password='adminpass123')

    def test_promotions_nav_and_console_models_reachable(self):
        list_response = self.client.get('/panel/gestion/promociones/')
        self.assertEqual(list_response.status_code, 200)
        self.assertContains(list_response, 'Nueva promoción')

        home = self.client.get('/panel/')
        self.assertContains(home, 'Promociones')

        console = self.client.get('/panel/gestion/sistema/')
        self.assertEqual(console.status_code, 200)
        body = console.content.decode('utf-8').lower()
        self.assertIn('disputa', body)
        self.assertIn('servicio', body)
        self.assertIn('promoc', body)
        self.assertIn('auditor', body)

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

    def _png_upload(self, name):
        import io

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buf = io.BytesIO()
        Image.new('RGB', (32, 32), color='blue').save(buf, format='PNG')
        return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')

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
                'avatar': self._png_upload('avatar.png'),
                'identity_document': self._png_upload('ine.png'),
                'approve_driver': 'on',
            },
        )

        driver = User.objects.get(username='nuevo_repartidor')
        profile = DeliveryProfile.objects.get(user=driver)
        self.assertRedirects(response, '/panel/repartidores/')
        self.assertTrue(driver.avatar)
        self.assertTrue(profile.identity_document)
        self.assertEqual(
            profile.verification_status,
            DeliveryProfile.VerificationStatus.APPROVED,
        )

    def test_create_driver_form_shows_document_fields(self):
        response = self.client.get('/panel/gestion/usuarios/nuevo/?role=driver')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Foto de perfil')
        self.assertContains(response, 'INE')
        self.assertContains(response, 'enctype="multipart/form-data"')

    def test_edit_driver_user_form_shows_document_fields(self):
        from accounts.models import DeliveryProfile

        driver = User.objects.create_user(
            username='edit_docs_driver',
            password='DriverPass123!',
            role=UserRole.DRIVER,
            phone='4431111111',
        )
        DeliveryProfile.objects.create(
            user=driver,
            vehicle_type=DeliveryProfile.VehicleType.MOTORCYCLE,
            license_plate='XYZ99',
        )

        response = self.client.get(f'/panel/gestion/usuarios/{driver.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Foto de perfil')
        self.assertContains(response, 'INE')
        self.assertContains(response, 'enctype="multipart/form-data"')

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

    def test_admin_can_create_service(self):
        page = self.client.get('/panel/gestion/servicios/nuevo/')
        self.assertEqual(page.status_code, 200)

        created = self.client.post(
            '/panel/gestion/servicios/nuevo/',
            {
                'name': 'Taller Express',
                'category': 'auto',
                'description': 'Frenos y aceite',
                'address': 'Centro',
                'schedule': 'Lun-Vie 9-18',
                'phone': '4431112233',
                'whatsapp': '',
                'instagram': '',
                'facebook': '',
                'is_active': 'on',
                'sort_order': '1',
            },
            follow=True,
        )
        self.assertEqual(created.status_code, 200)
        self.assertTrue(
            self.service.__class__.objects.filter(name='Taller Express').exists(),
        )
        self.assertContains(created, 'publicado')

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


class RestaurantPosToggleTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='pos_toggle_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        from restaurants.models import Restaurant

        owner = User.objects.create_user(
            username='pos_toggle_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=owner,
            name='Local POS Panel',
            category='comida',
            address='Calle 1',
            phone='123',
            pos_enabled=False,
        )

    def test_admin_can_toggle_pos_from_detail(self):
        self.client.login(username='pos_toggle_admin', password='adminpass123')
        detail = self.client.get(f'/panel/restaurantes/{self.restaurant.pk}/')
        self.assertEqual(detail.status_code, 200)
        self.assertContains(detail, 'Activar POS')

        response = self.client.post(f'/panel/restaurantes/{self.restaurant.pk}/toggle-pos/')
        self.assertEqual(response.status_code, 302)
        self.restaurant.refresh_from_db()
        self.assertTrue(self.restaurant.pos_enabled)

        detail = self.client.get(f'/panel/restaurantes/{self.restaurant.pk}/')
        self.assertContains(detail, 'Desactivar POS')


class PageContextTests(TestCase):
    def test_nav_groups_match_sidebar_architecture(self):
        from dashboard.page_context import page_context

        self.assertEqual(page_context('Dashboard', 'home')['nav_group'], '')
        self.assertEqual(page_context('Pedidos', 'orders')['nav_group'], 'operacion')
        self.assertEqual(page_context('Disputas', 'disputes')['nav_group'], 'operacion')
        self.assertEqual(page_context('Envíos', 'shipments')['nav_group'], 'operacion')
        self.assertEqual(page_context('Restaurantes', 'restaurants')['nav_group'], 'negocios')
        self.assertEqual(page_context('Productos', 'products')['nav_group'], 'negocios')
        self.assertEqual(page_context('Servicios', 'local-services')['nav_group'], 'negocios')
        self.assertEqual(page_context('Clientes', 'customers')['nav_group'], 'personas')
        self.assertEqual(page_context('Repartidores', 'drivers')['nav_group'], 'personas')
        self.assertEqual(page_context('Promociones', 'promotions')['nav_group'], 'marketing')
        self.assertEqual(page_context('Cupones', 'coupons')['nav_group'], 'marketing')
        self.assertEqual(page_context('Reseñas', 'reviews')['nav_group'], 'marketing')
        self.assertEqual(page_context('Reportes', 'reports')['nav_group'], '')
        self.assertEqual(page_context('Cuentas', 'users')['nav_group'], 'sistema')
        self.assertEqual(page_context('Consola', 'gestion')['nav_group'], 'sistema')


class PanelNavigationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='nav_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='nav_cliente',
            password='clientepass123',
            role=UserRole.CUSTOMER,
        )
        self.client.login(username='nav_admin', password='adminpass123')

    def test_sidebar_is_grouped_and_drops_legacy_label(self):
        response = self.client.get('/panel/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Dashboard')
        self.assertContains(response, 'Operación')
        self.assertContains(response, 'Negocios')
        self.assertContains(response, 'Personas')
        self.assertContains(response, 'Marketing')
        self.assertContains(response, 'Sistema')
        self.assertContains(response, 'Cuentas')
        self.assertContains(response, 'Reportes')
        self.assertContains(response, 'Envíos y mandados')
        self.assertContains(response, 'Consola técnica')
        self.assertNotContains(response, 'legado')
        self.assertNotContains(response, 'Todos los usuarios')

    def test_module_routes_still_resolve(self):
        paths = [
            '/panel/',
            '/panel/pedidos/',
            '/panel/restaurantes/',
            '/panel/clientes/',
            '/panel/repartidores/',
            '/panel/usuarios/',
            '/panel/reportes/',
            '/panel/gestion/envios/',
            '/panel/gestion/disputas/',
            '/panel/gestion/productos/',
            '/panel/gestion/promociones/',
            '/panel/gestion/cupones/',
            '/panel/gestion/servicios/',
            '/panel/gestion/resenas/',
        ]
        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)

    def test_accounts_list_excludes_customers_by_default(self):
        response = self.client.get('/panel/usuarios/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Cuentas')
        self.assertContains(response, 'nav_admin')
        self.assertNotContains(response, 'nav_cliente')

        filtered = self.client.get('/panel/usuarios/', {'role': UserRole.CUSTOMER})
        self.assertEqual(filtered.status_code, 200)
        self.assertContains(filtered, 'nav_cliente')

    def test_orders_list_uses_action_menu(self):
        from decimal import Decimal

        from restaurants.models import Restaurant

        owner = User.objects.create_user(
            username='nav_owner',
            password='ownerpass123',
            role=UserRole.RESTAURANT,
        )
        restaurant = Restaurant.objects.create(
            owner=owner,
            name='Tacos Nav',
            address='Calle 1',
        )
        Order.objects.create(
            customer=self.customer,
            restaurant=restaurant,
            status=OrderStatus.PENDING,
            delivery_address='Casa',
            subtotal=Decimal('10.00'),
            delivery_fee=Decimal('5.00'),
            total=Decimal('15.00'),
        )
        response = self.client.get('/panel/pedidos/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Más acciones')
        self.assertContains(response, 'zin-action-menu')
        self.assertContains(response, 'zin-filter-bar')


class DashboardHomeTests(TestCase):
    def setUp(self):
        from decimal import Decimal

        from restaurants.models import Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='dash_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='dash_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
        )
        self.owner = User.objects.create_user(
            username='dash_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Dash Local',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.Decimal = Decimal
        self.client.login(username='dash_admin', password='adminpass123')

    def _make_order(self, **kwargs):
        from orders.models import PaymentStatus

        defaults = {
            'customer': self.customer,
            'restaurant': self.restaurant,
            'status': OrderStatus.PENDING,
            'delivery_address': 'Casa',
            'subtotal': self.Decimal('100.00'),
            'delivery_fee': self.Decimal('20.00'),
            'total': self.Decimal('120.00'),
            'payment_status': PaymentStatus.PENDING,
        }
        defaults.update(kwargs)
        return Order.objects.create(**defaults)

    def test_home_shows_ops_kpis_and_attention_without_invented_percent(self):
        from dashboard.services import get_dashboard_stats

        response = self.client.get('/panel/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Pedidos hoy')
        self.assertContains(response, 'Requiere atención')
        self.assertContains(response, 'Operación actual')
        self.assertContains(response, 'Todo al día')
        self.assertNotContains(response, '% vs ayer')

        stats = get_dashboard_stats()
        self.assertEqual(stats['orders_today'], 0)
        self.assertIsNone(stats['kpi_orders_today_change'])
        self.assertIsNone(stats['kpi_sales_today_change'])

    def test_orders_today_kpi_and_live_table(self):
        order = self._make_order()
        response = self.client.get('/panel/')
        self.assertContains(response, 'Operación actual')
        self.assertContains(response, order.display_ref)
        self.assertContains(response, 'Pendiente')

        from dashboard.services import get_dashboard_stats
        stats = get_dashboard_stats()
        self.assertEqual(stats['orders_today'], 1)
        self.assertEqual(stats['orders_active'], 1)
        self.assertIsNone(stats['kpi_orders_today_change'])

    def test_percent_vs_yesterday_only_when_yesterday_had_orders(self):
        from datetime import timedelta

        from django.utils import timezone

        from dashboard.services import get_dashboard_stats

        today_order = self._make_order()
        yesterday_order = self._make_order()
        Order.objects.filter(pk=yesterday_order.pk).update(
            created_at=timezone.now() - timedelta(days=1),
        )
        stats = get_dashboard_stats()
        self.assertEqual(stats['orders_today'], 1)
        self.assertIsNotNone(stats['kpi_orders_today_change'])
        self.assertEqual(stats['kpi_orders_today_change']['pct'], 0)

        Order.objects.filter(pk=today_order.pk).delete()
        extra = self._make_order()
        extra2 = self._make_order()
        stats = get_dashboard_stats()
        self.assertEqual(stats['orders_today'], 2)
        self.assertEqual(stats['kpi_orders_today_change']['pct'], 100)
        self.assertEqual(stats['kpi_orders_today_change']['direction'], 'up')

        response = self.client.get('/panel/')
        self.assertContains(response, '% vs ayer')

    def test_stale_pending_and_failed_payment_alerts(self):
        from datetime import timedelta

        from django.utils import timezone

        from dashboard.services import PENDING_STALE_MINUTES, get_dashboard_stats
        from orders.models import PaymentStatus

        stale = self._make_order()
        Order.objects.filter(pk=stale.pk).update(
            created_at=timezone.now() - timedelta(minutes=PENDING_STALE_MINUTES + 5),
        )
        failed = self._make_order(payment_status=PaymentStatus.FAILED, status=OrderStatus.ACCEPTED)
        stats = get_dashboard_stats()
        titles = [item['title'] for item in stats['attention_items']]
        self.assertTrue(any('pendiente' in title for title in titles))
        self.assertTrue(any('pago' in title.lower() for title in titles))

        response = self.client.get('/panel/')
        self.assertContains(response, 'cobro fallido')
        self.assertContains(response, f'payment={PaymentStatus.FAILED}')

        listed = self.client.get(f'/panel/pedidos/?payment={PaymentStatus.FAILED}')
        self.assertEqual(listed.status_code, 200)
        self.assertContains(listed, f'/panel/pedidos/{failed.pk}/')
        self.assertContains(listed, 'Pago fallido')

    def test_expired_promo_alert_links_to_promotions(self):
        from datetime import timedelta

        from django.utils import timezone
        from restaurants.models import Product, ProductPromotion, PromoType

        from dashboard.services import get_dashboard_stats

        product = Product.objects.create(
            restaurant=self.restaurant,
            name='Torta',
            price=self.Decimal('40.00'),
        )
        ProductPromotion.objects.create(
            restaurant=self.restaurant,
            product=product,
            promo_type=PromoType.PERCENT_OFF,
            percent_off=10,
            valid_until=timezone.now() - timedelta(hours=2),
            is_active=True,
        )
        stats = get_dashboard_stats()
        self.assertTrue(
            any('promoción' in item['title'] for item in stats['attention_items'])
        )
        response = self.client.get('/panel/')
        self.assertContains(response, 'Torta')
        expired_list = self.client.get('/panel/gestion/promociones/?expired=1')
        self.assertEqual(expired_list.status_code, 200)
        self.assertContains(expired_list, 'Torta')

    def test_active_shipments_kpi(self):
        from orders.models import Shipment, ShipmentKind, ShipmentStatus

        from dashboard.services import get_dashboard_stats

        Shipment.objects.create(
            customer=self.customer,
            kind=ShipmentKind.MANDADO,
            status=ShipmentStatus.PENDING,
            description='Leche',
            pickup_address='Tienda',
            delivery_address='Casa',
        )
        Shipment.objects.create(
            customer=self.customer,
            kind=ShipmentKind.COURIER,
            status=ShipmentStatus.ON_THE_WAY,
            description='Paquete',
            pickup_address='A',
            delivery_address='B',
        )
        Shipment.objects.create(
            customer=self.customer,
            kind=ShipmentKind.MANDADO,
            status=ShipmentStatus.DELIVERED,
            description='Hecho',
            pickup_address='A',
            delivery_address='B',
        )
        stats = get_dashboard_stats()
        self.assertEqual(stats['mandados_active'], 1)
        self.assertEqual(stats['envios_active'], 1)
        response = self.client.get('/panel/')
        self.assertContains(response, 'Mandados activos')
        self.assertContains(response, 'Envíos activos')


class OrderPanelTests(TestCase):
    def setUp(self):
        from decimal import Decimal

        from restaurants.models import Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='order_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='order_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
            first_name='Ana',
            phone='4435550000',
        )
        self.owner = User.objects.create_user(
            username='order_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.driver = User.objects.create_user(
            username='order_driver',
            password='pass123',
            role=UserRole.DRIVER,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Tacos Centro',
            address='Calle 1',
        )
        self.other_restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Pizza Norte',
            address='Calle 2',
        )
        self.Decimal = Decimal
        self.client.login(username='order_admin', password='adminpass123')

    def _make_order(self, **kwargs):
        from orders.models import PaymentMethod, PaymentStatus

        defaults = {
            'customer': self.customer,
            'restaurant': self.restaurant,
            'status': OrderStatus.PENDING,
            'delivery_address': 'Casa 12',
            'subtotal': self.Decimal('80.00'),
            'delivery_fee': self.Decimal('20.00'),
            'total': self.Decimal('100.00'),
            'payment_method': PaymentMethod.CASH,
            'payment_status': PaymentStatus.PENDING,
        }
        defaults.update(kwargs)
        return Order.objects.create(**defaults)

    def test_list_filters_restaurant_driver_method_and_search(self):
        from datetime import timedelta

        from django.utils import timezone
        from orders.models import PaymentMethod, PaymentStatus

        cash = self._make_order()
        online = self._make_order(
            restaurant=self.other_restaurant,
            payment_method=PaymentMethod.ONLINE,
            payment_status=PaymentStatus.PAID,
            driver=self.driver,
            status=OrderStatus.ACCEPTED,
        )
        unassigned = self._make_order(status=OrderStatus.READY)

        by_restaurant = self.client.get('/panel/pedidos/', {'restaurant': self.other_restaurant.pk})
        self.assertContains(by_restaurant, online.display_ref)
        self.assertNotContains(by_restaurant, cash.display_ref)

        by_driver = self.client.get('/panel/pedidos/', {'driver': 'none'})
        self.assertContains(by_driver, cash.display_ref)
        self.assertContains(by_driver, unassigned.display_ref)
        self.assertNotContains(by_driver, online.display_ref)

        by_method = self.client.get('/panel/pedidos/', {'method': PaymentMethod.ONLINE})
        self.assertContains(by_method, online.display_ref)
        self.assertNotContains(by_method, cash.display_ref)

        by_code = self.client.get('/panel/pedidos/', {'q': cash.code})
        self.assertContains(by_code, cash.display_ref)
        self.assertNotContains(by_code, online.display_ref)

        by_phone = self.client.get('/panel/pedidos/', {'q': '4435550000'})
        self.assertContains(by_phone, cash.display_ref)

        today = timezone.localdate().isoformat()
        by_date = self.client.get('/panel/pedidos/', {'date_from': today, 'date_to': today})
        self.assertContains(by_date, cash.display_ref)

        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        empty_date = self.client.get('/panel/pedidos/', {'date_from': yesterday, 'date_to': yesterday})
        self.assertContains(empty_date, 'No hay pedidos con estos filtros')

        listed = self.client.get('/panel/pedidos/', {'restaurant': self.restaurant.pk})
        self.assertContains(listed, f'restaurant={self.restaurant.pk}')
        self.assertContains(listed, 'status=pending')
        self.assertContains(listed, 'Quitar filtros')

    def test_detail_has_hierarchy_and_links(self):
        order = self._make_order()
        response = self.client.get(f'/panel/pedidos/{order.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, order.display_ref)
        self.assertContains(response, 'Seguimiento')
        self.assertContains(response, 'Tacos Centro')
        self.assertContains(response, f'/panel/restaurantes/{self.restaurant.pk}/')
        self.assertContains(response, f'/panel/clientes/{self.customer.pk}/')
        self.assertContains(response, 'Editar')


class RestaurantPanelTests(TestCase):
    def setUp(self):
        from decimal import Decimal

        from restaurants.models import Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='rest_panel_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='rest_panel_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
            first_name='Luis',
        )
        self.owner = User.objects.create_user(
            username='rest_panel_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.open_restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Tacos Abiertos',
            address='Centro 1',
            phone='4431110000',
            is_active=True,
            accepting_orders=True,
        )
        self.paused_restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Pizza Pausada',
            address='Norte 2',
            is_active=True,
            accepting_orders=False,
        )
        self.pending_restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Fonda Pendiente',
            address='Sur 3',
            is_active=False,
            accepting_orders=False,
        )
        self.Decimal = Decimal
        self.client.login(username='rest_panel_admin', password='adminpass123')

    def _make_order(self, restaurant=None, **kwargs):
        from orders.models import PaymentMethod, PaymentStatus

        defaults = {
            'customer': self.customer,
            'restaurant': restaurant or self.open_restaurant,
            'status': OrderStatus.PENDING,
            'delivery_address': 'Casa 1',
            'subtotal': self.Decimal('80.00'),
            'delivery_fee': self.Decimal('20.00'),
            'total': self.Decimal('100.00'),
            'payment_method': PaymentMethod.CASH,
            'payment_status': PaymentStatus.PENDING,
        }
        defaults.update(kwargs)
        return Order.objects.create(**defaults)

    def test_list_shows_open_closed_today_orders_and_sales(self):
        from django.utils import timezone
        from orders.models import OrderSource, PaymentStatus

        self._make_order()
        paid = self._make_order(
            status=OrderStatus.DELIVERED,
            payment_status=PaymentStatus.PAID,
            delivered_at=timezone.now(),
        )
        self._make_order(source=OrderSource.POS, subtotal=self.Decimal('999.00'))

        response = self.client.get('/panel/restaurantes/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Tacos Abiertos')
        self.assertContains(response, 'Abierto')
        self.assertContains(response, 'Cerrado')
        self.assertContains(response, 'Pedidos hoy')
        self.assertContains(response, 'Ventas hoy')
        self.assertContains(response, 'Última actividad')
        body = response.content.decode()
        open_idx = body.index('Tacos Abiertos')
        paused_idx = body.index('Pizza Pausada')
        open_chunk = body[open_idx:open_idx + 1800]
        paused_chunk = body[paused_idx:paused_idx + 1800]
        self.assertIn('Abierto', open_chunk)
        self.assertIn('Cerrado', paused_chunk)
        self.assertIn('>2<', open_chunk)
        self.assertIn('$80', open_chunk)
        self.assertNotIn('$999', body)
        self.assertContains(response, 'Nuevo restaurante')

    def test_list_filters_active_open_paused_and_search(self):
        listed_open = self.client.get('/panel/restaurantes/', {'open': '1'})
        self.assertContains(listed_open, 'Tacos Abiertos')
        self.assertNotContains(listed_open, 'Pizza Pausada')
        self.assertNotContains(listed_open, 'Fonda Pendiente')

        listed_paused = self.client.get('/panel/restaurantes/', {'paused': '1'})
        self.assertContains(listed_paused, 'Pizza Pausada')
        self.assertNotContains(listed_paused, 'Tacos Abiertos')

        listed_pending = self.client.get('/panel/restaurantes/', {'active': '0'})
        self.assertContains(listed_pending, 'Fonda Pendiente')
        self.assertNotContains(listed_pending, 'Tacos Abiertos')

        by_phone = self.client.get('/panel/restaurantes/', {'q': '4431110000'})
        self.assertContains(by_phone, 'Tacos Abiertos')
        self.assertNotContains(by_phone, 'Pizza Pausada')
        self.assertContains(by_phone, 'Quitar filtros')
        self.assertContains(by_phone, 'q=4431110000')

    def test_detail_tabs_and_header(self):
        from datetime import timedelta

        from django.utils import timezone
        from restaurants.models import Product, ProductPromotion, PromoType

        product = Product.objects.create(
            restaurant=self.open_restaurant,
            name='Taco de asada',
            price=self.Decimal('35.00'),
            is_available=True,
        )
        order = self._make_order()
        ProductPromotion.objects.create(
            restaurant=self.open_restaurant,
            product=product,
            promo_type=PromoType.PERCENT_OFF,
            percent_off=10,
            valid_until=timezone.now() + timedelta(days=2),
            is_active=True,
        )

        detail = self.client.get(f'/panel/restaurantes/{self.open_restaurant.pk}/')
        self.assertEqual(detail.status_code, 200)
        self.assertContains(detail, 'Tacos Abiertos')
        self.assertContains(detail, 'Abierto')
        self.assertContains(detail, 'Información')
        self.assertContains(detail, 'Activar POS')
        self.assertContains(detail, 'Centro 1')
        self.assertContains(detail, '?tab=menu')
        self.assertContains(detail, '?tab=config')

        menu = self.client.get(
            f'/panel/restaurantes/{self.open_restaurant.pk}/',
            {'tab': 'menu'},
        )
        self.assertContains(menu, 'Taco de asada')
        self.assertContains(menu, 'Ver en productos')

        orders = self.client.get(
            f'/panel/restaurantes/{self.open_restaurant.pk}/',
            {'tab': 'orders'},
        )
        self.assertContains(orders, order.display_ref)
        self.assertContains(orders, f'/panel/pedidos/{order.pk}/')

        promos = self.client.get(
            f'/panel/restaurantes/{self.open_restaurant.pk}/',
            {'tab': 'promos'},
        )
        self.assertContains(promos, 'Taco de asada')
        self.assertContains(promos, 'Activa')

        stats = self.client.get(
            f'/panel/restaurantes/{self.open_restaurant.pk}/',
            {'tab': 'stats'},
        )
        self.assertContains(stats, 'Pedidos hoy')
        self.assertContains(stats, 'Ventas hoy')
        self.assertContains(stats, '>1<')

        config = self.client.get(
            f'/panel/restaurantes/{self.open_restaurant.pk}/',
            {'tab': 'config'},
        )
        self.assertContains(config, 'Checklist de alta')
        self.assertContains(config, 'ZinApp POS')


class DriverPanelTests(TestCase):
    def setUp(self):
        from decimal import Decimal

        from accounts.models import DeliveryProfile
        from restaurants.models import Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='drv_panel_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='drv_panel_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
        )
        self.owner = User.objects.create_user(
            username='drv_panel_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Tacos Driver',
            address='Centro',
        )
        self.available_user = User.objects.create_user(
            username='drv_available',
            password='pass123',
            role=UserRole.DRIVER,
            first_name='Ana',
            last_name='Moto',
            phone='4432220000',
        )
        self.busy_user = User.objects.create_user(
            username='drv_busy',
            password='pass123',
            role=UserRole.DRIVER,
            first_name='Luis',
            last_name='Ruta',
        )
        self.offline_user = User.objects.create_user(
            username='drv_offline',
            password='pass123',
            role=UserRole.DRIVER,
            first_name='Eva',
            last_name='Casa',
        )
        self.pending_user = User.objects.create_user(
            username='drv_pending',
            password='pass123',
            role=UserRole.DRIVER,
            first_name='Paco',
            last_name='Nuevo',
        )
        self.available_profile = DeliveryProfile.objects.create(
            user=self.available_user,
            is_available=True,
            verification_status=DeliveryProfile.VerificationStatus.APPROVED,
            license_plate='AAA111',
        )
        self.busy_profile = DeliveryProfile.objects.create(
            user=self.busy_user,
            is_available=True,
            verification_status=DeliveryProfile.VerificationStatus.APPROVED,
            license_plate='BBB222',
        )
        self.offline_profile = DeliveryProfile.objects.create(
            user=self.offline_user,
            is_available=False,
            verification_status=DeliveryProfile.VerificationStatus.APPROVED,
            license_plate='CCC333',
        )
        self.pending_profile = DeliveryProfile.objects.create(
            user=self.pending_user,
            is_available=False,
            verification_status=DeliveryProfile.VerificationStatus.PENDING,
        )
        self.Decimal = Decimal
        self.client.login(username='drv_panel_admin', password='adminpass123')

    def _make_order(self, **kwargs):
        from orders.models import PaymentStatus

        defaults = {
            'customer': self.customer,
            'restaurant': self.restaurant,
            'status': OrderStatus.PENDING,
            'delivery_address': 'Casa',
            'subtotal': self.Decimal('50.00'),
            'delivery_fee': self.Decimal('20.00'),
            'total': self.Decimal('70.00'),
            'payment_status': PaymentStatus.PENDING,
        }
        defaults.update(kwargs)
        return Order.objects.create(**defaults)

    def test_list_shows_busy_available_and_today_deliveries(self):
        from django.utils import timezone

        current = self._make_order(
            driver=self.busy_user,
            status=OrderStatus.ON_THE_WAY,
        )
        self._make_order(
            driver=self.available_user,
            status=OrderStatus.DELIVERED,
            delivered_at=timezone.now(),
        )

        response = self.client.get('/panel/repartidores/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Ana Moto')
        self.assertContains(response, 'Luis Ruta')
        self.assertContains(response, 'Disponibles')
        self.assertContains(response, 'Ocupados')
        self.assertContains(response, 'No disponibles')
        body = response.content.decode()
        busy_chunk = body[body.index('Luis Ruta'):body.index('Luis Ruta') + 1600]
        available_chunk = body[body.index('Ana Moto'):body.index('Ana Moto') + 1600]
        self.assertIn('Ocupado', busy_chunk)
        self.assertIn(current.display_ref, busy_chunk)
        self.assertIn('Disponible', available_chunk)
        self.assertIn('>1<', available_chunk)
        self.assertContains(response, 'Nuevo repartidor')

    def test_list_filters_status_and_search(self):
        self._make_order(driver=self.busy_user, status=OrderStatus.ON_THE_WAY)

        busy = self.client.get('/panel/repartidores/', {'status': 'busy'})
        self.assertContains(busy, 'Luis Ruta')
        self.assertNotContains(busy, 'Ana Moto')
        self.assertNotContains(busy, 'Eva Casa')

        available = self.client.get('/panel/repartidores/', {'status': 'available'})
        self.assertContains(available, 'Ana Moto')
        self.assertNotContains(available, 'Luis Ruta')
        self.assertNotContains(available, 'Eva Casa')

        offline = self.client.get('/panel/repartidores/', {'status': 'offline'})
        self.assertContains(offline, 'Eva Casa')
        self.assertNotContains(offline, 'Ana Moto')

        pending = self.client.get('/panel/repartidores/', {'verification': 'pending'})
        self.assertContains(pending, 'Paco Nuevo')
        self.assertNotContains(pending, 'Ana Moto')

        by_phone = self.client.get('/panel/repartidores/', {'q': '4432220000'})
        self.assertContains(by_phone, 'Ana Moto')
        self.assertNotContains(by_phone, 'Luis Ruta')
        self.assertContains(by_phone, 'Quitar filtros')

    def test_detail_tabs_and_pending_opens_verification(self):
        from django.utils import timezone

        order = self._make_order(
            driver=self.busy_user,
            status=OrderStatus.ON_THE_WAY,
        )
        self._make_order(
            driver=self.available_user,
            status=OrderStatus.DELIVERED,
            delivered_at=timezone.now(),
        )

        pending = self.client.get(f'/panel/repartidores/{self.pending_profile.pk}/')
        self.assertEqual(pending.status_code, 200)
        self.assertContains(pending, 'Aprobar repartidor')
        self.assertContains(pending, 'Checklist de alta')
        self.assertContains(pending, 'Validación')

        approved = self.client.get(f'/panel/repartidores/{self.available_profile.pk}/')
        self.assertContains(approved, 'Información')
        self.assertContains(approved, 'Disponible')
        self.assertContains(approved, 'AAA111')

        jobs = self.client.get(
            f'/panel/repartidores/{self.busy_profile.pk}/',
            {'tab': 'jobs'},
        )
        self.assertContains(jobs, 'En curso')
        self.assertContains(jobs, order.display_ref)
        self.assertContains(jobs, f'/panel/pedidos/{order.pk}/')
        self.assertContains(jobs, 'Ocupado')


class ShipmentPanelTests(TestCase):
    def setUp(self):
        from decimal import Decimal

        from accounts.models import DeliveryProfile
        from orders.models import Shipment, ShipmentKind, ShipmentStatus

        self.client = Client()
        self.admin = User.objects.create_user(
            username='ship_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='ship_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
            first_name='Marta',
            phone='4434440000',
        )
        self.other = User.objects.create_user(
            username='ship_other',
            password='pass123',
            role=UserRole.CUSTOMER,
        )
        self.driver = User.objects.create_user(
            username='ship_driver',
            password='pass123',
            role=UserRole.DRIVER,
            first_name='Raul',
        )
        DeliveryProfile.objects.create(user=self.driver)
        self.Shipment = Shipment
        self.ShipmentKind = ShipmentKind
        self.ShipmentStatus = ShipmentStatus
        self.Decimal = Decimal
        self.client.login(username='ship_admin', password='adminpass123')

    def _make(self, **kwargs):
        from orders.models import PaymentMethod, PaymentStatus

        defaults = {
            'customer': self.customer,
            'status': self.ShipmentStatus.PENDING,
            'kind': self.ShipmentKind.COURIER,
            'description': 'Paquete chico',
            'pickup_address': 'Bodega 1',
            'delivery_address': 'Casa 9',
            'delivery_fee': self.Decimal('25.00'),
            'total': self.Decimal('25.00'),
            'payment_method': PaymentMethod.CASH,
            'payment_status': PaymentStatus.PENDING,
        }
        defaults.update(kwargs)
        return self.Shipment.objects.create(**defaults)

    def test_list_filters_kind_driver_customer_and_search(self):
        from orders.models import PaymentMethod

        courier = self._make()
        mandado = self._make(
            kind=self.ShipmentKind.MANDADO,
            description='Leche y pan',
            driver=self.driver,
            payment_method=PaymentMethod.ONLINE,
        )
        other = self._make(customer=self.other, description='Otro')

        by_kind = self.client.get('/panel/gestion/envios/', {'kind': 'mandado'})
        self.assertContains(by_kind, f'#{mandado.pk}')
        self.assertNotContains(by_kind, f'#{courier.pk}')
        self.assertContains(by_kind, 'status=pending')
        self.assertContains(by_kind, 'Quitar filtros')

        by_driver = self.client.get('/panel/gestion/envios/', {'driver': 'none'})
        self.assertContains(by_driver, f'#{courier.pk}')
        self.assertNotContains(by_driver, f'#{mandado.pk}')

        by_customer = self.client.get('/panel/gestion/envios/', {'customer': self.customer.pk})
        self.assertContains(by_customer, f'#{courier.pk}')
        self.assertNotContains(by_customer, f'#{other.pk}')

        by_phone = self.client.get('/panel/gestion/envios/', {'q': '4434440000'})
        self.assertContains(by_phone, f'#{courier.pk}')
        self.assertNotContains(by_phone, f'#{other.pk}')

        by_id = self.client.get('/panel/gestion/envios/', {'q': str(mandado.pk)})
        self.assertContains(by_id, f'#{mandado.pk}')
        self.assertNotContains(by_id, f'#{courier.pk}')

    def test_detail_has_hierarchy_and_keeps_status_form(self):
        shipment = self._make(driver=self.driver, status=self.ShipmentStatus.PICKED_UP)
        response = self.client.get(f'/panel/gestion/envios/{shipment.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'#{shipment.pk}')
        self.assertContains(response, 'Seguimiento')
        self.assertContains(response, 'Guardar cambios')
        self.assertContains(response, 'Marta')
        self.assertContains(response, f'/panel/clientes/{self.customer.pk}/')
        self.assertContains(response, f'/panel/repartidores/')
        self.assertContains(response, 'Recoger en')
        self.assertContains(response, 'Bodega 1')


class MarketingPanelTests(TestCase):
    def setUp(self):
        from datetime import timedelta
        from decimal import Decimal

        from django.utils import timezone
        from restaurants.models import Product, Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='mkt_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.owner = User.objects.create_user(
            username='mkt_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.customer = User.objects.create_user(
            username='mkt_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
            first_name='Lucia',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Mkt Tacos',
            address='Centro',
            is_active=True,
        )
        self.other_restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Mkt Pizza',
            address='Norte',
            is_active=True,
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco promo',
            price=Decimal('30.00'),
            is_available=True,
        )
        self.other_product = Product.objects.create(
            restaurant=self.other_restaurant,
            name='Pizza promo',
            price=Decimal('80.00'),
            is_available=True,
        )
        self.timezone = timezone
        self.timedelta = timedelta
        self.Decimal = Decimal
        self.client.login(username='mkt_admin', password='adminpass123')

    def test_promotions_filter_live_expired_restaurant_and_nav(self):
        from restaurants.models import ProductPromotion, PromoType

        live = ProductPromotion.objects.create(
            restaurant=self.restaurant,
            product=self.product,
            promo_type=PromoType.PERCENT_OFF,
            percent_off=20,
            label='Taco 20',
            valid_until=self.timezone.now() + self.timedelta(days=2),
            is_active=True,
        )
        expired = ProductPromotion.objects.create(
            restaurant=self.other_restaurant,
            product=self.other_product,
            promo_type=PromoType.PERCENT_OFF,
            percent_off=10,
            label='Pizza vieja',
            valid_until=self.timezone.now() - self.timedelta(hours=2),
            is_active=True,
        )

        listed = self.client.get('/panel/gestion/promociones/')
        self.assertEqual(listed.status_code, 200)
        self.assertContains(listed, 'aria-label="Marketing"')
        self.assertContains(listed, 'Cupones')
        self.assertContains(listed, 'Reseñas')
        self.assertContains(listed, live.product.name)
        self.assertContains(listed, expired.product.name)

        vigentes = self.client.get('/panel/gestion/promociones/', {'status': 'live'})
        self.assertContains(vigentes, live.product.name)
        self.assertNotContains(vigentes, expired.product.name)
        self.assertContains(vigentes, 'Quitar filtros')
        self.assertContains(vigentes, 'expired=1')

        vencidas = self.client.get('/panel/gestion/promociones/', {'expired': '1'})
        self.assertContains(vencidas, expired.product.name)
        self.assertNotContains(vencidas, live.product.name)

        by_rest = self.client.get(
            '/panel/gestion/promociones/',
            {'restaurant': str(self.restaurant.pk)},
        )
        self.assertContains(by_rest, live.product.name)
        self.assertNotContains(by_rest, expired.product.name)
        self.assertContains(by_rest, f'/panel/restaurantes/{self.restaurant.pk}/?tab=promos')

    def test_coupons_filter_live_expired_exhausted_and_search(self):
        from orders.models import Coupon

        live = Coupon.objects.create(
            code='LIVE10',
            description='Vigente ahora',
            discount_percent=10,
            is_active=True,
        )
        Coupon.objects.create(
            code='OLD10',
            discount_percent=10,
            is_active=True,
            expires_at=self.timezone.now() - self.timedelta(days=1),
        )
        Coupon.objects.create(
            code='MAX10',
            discount_percent=10,
            is_active=True,
            max_uses=1,
            times_used=1,
        )
        Coupon.objects.create(
            code='OFF10',
            discount_percent=10,
            is_active=False,
        )

        listed = self.client.get('/panel/gestion/cupones/')
        self.assertEqual(listed.status_code, 200)
        self.assertContains(listed, 'aria-label="Marketing"')
        self.assertContains(listed, 'LIVE10')
        self.assertContains(listed, 'OLD10')
        self.assertContains(listed, 'Vigente')
        self.assertContains(listed, 'Vencido')
        self.assertContains(listed, 'Agotado')
        self.assertContains(listed, 'Inactivo')

        vigentes = self.client.get('/panel/gestion/cupones/', {'status': 'live'})
        self.assertContains(vigentes, 'LIVE10')
        self.assertNotContains(vigentes, 'OLD10')
        self.assertNotContains(vigentes, 'MAX10')
        self.assertNotContains(vigentes, 'OFF10')
        self.assertContains(vigentes, 'Quitar filtros')

        vencidos = self.client.get('/panel/gestion/cupones/', {'status': 'expired'})
        self.assertContains(vencidos, 'OLD10')
        self.assertNotContains(vencidos, 'LIVE10')

        agotados = self.client.get('/panel/gestion/cupones/', {'status': 'exhausted'})
        self.assertContains(agotados, 'MAX10')
        self.assertNotContains(agotados, 'LIVE10')

        inactivos = self.client.get('/panel/gestion/cupones/', {'active': '0'})
        self.assertContains(inactivos, 'OFF10')
        self.assertNotContains(inactivos, 'LIVE10')

        search = self.client.get('/panel/gestion/cupones/', {'q': 'Vigente ahora'})
        self.assertContains(search, 'LIVE10')
        self.assertNotContains(search, 'OLD10')
        self.assertContains(search, str(live.code))

    def test_reviews_filter_stars_restaurant_search_and_order_link(self):
        from orders.models import Review

        good_order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.DELIVERED,
            delivery_address='Casa',
            subtotal=self.Decimal('80.00'),
            delivery_fee=self.Decimal('20.00'),
            total=self.Decimal('100.00'),
        )
        low_order = Order.objects.create(
            customer=self.customer,
            restaurant=self.other_restaurant,
            status=OrderStatus.DELIVERED,
            delivery_address='Casa',
            subtotal=self.Decimal('50.00'),
            delivery_fee=self.Decimal('20.00'),
            total=self.Decimal('70.00'),
        )
        good = Review.objects.create(
            order=good_order,
            customer=self.customer,
            restaurant=self.restaurant,
            restaurant_rating=5,
            comment='Tacos excelentes',
        )
        Review.objects.create(
            order=low_order,
            customer=self.customer,
            restaurant=self.other_restaurant,
            restaurant_rating=2,
            comment='Llegó frío',
        )

        listed = self.client.get('/panel/gestion/resenas/')
        self.assertEqual(listed.status_code, 200)
        self.assertContains(listed, 'aria-label="Marketing"')
        self.assertContains(listed, 'Promedio restaurante')
        self.assertContains(listed, 'Tacos excelentes')
        self.assertContains(listed, 'Llegó frío')
        self.assertContains(listed, f'/panel/pedidos/{good.order_id}/')
        self.assertContains(listed, f'/panel/clientes/{self.customer.pk}/')
        self.assertContains(listed, 'Eliminar')

        by_stars = self.client.get('/panel/gestion/resenas/', {'stars': '5'})
        self.assertContains(by_stars, 'Tacos excelentes')
        self.assertNotContains(by_stars, 'Llegó frío')
        self.assertContains(by_stars, 'Quitar filtros')
        self.assertContains(by_stars, 'stars=2')

        by_rest = self.client.get(
            '/panel/gestion/resenas/',
            {'restaurant': str(self.other_restaurant.pk)},
        )
        self.assertContains(by_rest, 'Llegó frío')
        self.assertNotContains(by_rest, 'Tacos excelentes')

        by_comment = self.client.get('/panel/gestion/resenas/', {'q': 'excelentes'})
        self.assertContains(by_comment, 'Tacos excelentes')
        self.assertNotContains(by_comment, 'Llegó frío')

        restaurant_detail = self.client.get(
            f'/panel/restaurantes/{self.restaurant.pk}/',
        )
        self.assertContains(
            restaurant_detail,
            f'/panel/gestion/resenas/?restaurant={self.restaurant.pk}',
        )


class ReportsPanelTests(TestCase):
    def setUp(self):
        from decimal import Decimal

        from restaurants.models import Restaurant

        self.client = Client()
        self.admin = User.objects.create_user(
            username='rep_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username='rep_customer',
            password='pass123',
            role=UserRole.CUSTOMER,
            first_name='Nora',
        )
        owner = User.objects.create_user(
            username='rep_owner',
            password='pass123',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=owner,
            name='Rep Tacos',
            address='Centro',
            is_active=True,
        )
        self.Decimal = Decimal
        self.client.login(username='rep_admin', password='adminpass123')

    def test_reports_reuses_financial_data_and_counts_cancelled_and_customers(self):
        from django.utils import timezone
        from orders.models import PaymentMethod, PaymentStatus

        from dashboard.services import get_panel_report

        paid = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.DELIVERED,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            delivery_address='Casa',
            subtotal=self.Decimal('100.00'),
            delivery_fee=self.Decimal('20.00'),
            total=self.Decimal('120.00'),
            delivered_at=timezone.now(),
        )
        cancelled = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.CANCELLED,
            delivery_address='Casa',
            subtotal=self.Decimal('40.00'),
            delivery_fee=self.Decimal('20.00'),
            total=self.Decimal('60.00'),
        )

        report = get_panel_report({'period': 'month'})
        self.assertEqual(report['cantidad_pedidos_completados'], 1)
        self.assertEqual(report['total_ventas_productos'], self.Decimal('100.00'))
        self.assertEqual(report['cancelled_count'], 1)
        self.assertEqual(report['new_customers'], 1)
        self.assertEqual(report['orders_created'], 2)
        methods = {row['method']: row for row in report['by_payment_method']}
        self.assertEqual(methods['cash']['orders_count'], 1)

        page = self.client.get('/panel/reportes/')
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, 'Reportes')
        self.assertContains(page, 'Cancelados')
        self.assertContains(page, 'Métodos de pago')
        self.assertContains(page, 'Clientes nuevos')
        self.assertContains(page, 'Efectivo')
        self.assertContains(page, f'/panel/pedidos/{paid.pk}/')
        self.assertContains(page, 'status=cancelled')
        self.assertNotContains(page, '% vs ayer')

        home = self.client.get('/panel/')
        self.assertContains(home, 'Ver reportes')
        self.assertContains(home, '/panel/reportes/')
        self.assertNotContains(home, 'Más detalle financiero')

        accounts = self.client.get('/panel/usuarios/', {'q': 'missing-user'})
        self.assertContains(accounts, 'Quitar filtros')
        self.assertContains(accounts, 'Equipo')

        console = self.client.get('/panel/gestion/sistema/')
        self.assertEqual(console.status_code, 200)
        self.assertContains(console, 'Consola técnica')
        self.assertContains(console, 'trabajo diario')




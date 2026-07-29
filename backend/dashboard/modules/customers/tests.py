"""Pruebas del módulo panel Clientes."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from accounts.models import DeliveryProfile, UserRole
from orders.models import Order, OrderStatus
from restaurants.models import Restaurant

User = get_user_model()


class CustomerModuleTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            username='panel_admin',
            password='adminpass123',
            role=UserRole.ADMIN,
            is_staff=True,
            phone='4431111111',
            email='admin@example.com',
        )
        self.customer = User.objects.create_user(
            username='cli_uno',
            password='clientepass123',
            role=UserRole.CUSTOMER,
            first_name='Ana',
            last_name='Cliente',
            phone='4432222222',
            email='ana@example.com',
        )
        self.driver = User.objects.create_user(
            username='rep_uno',
            password='driverpass123',
            role=UserRole.DRIVER,
            phone='4433333333',
            email='rep@example.com',
        )
        DeliveryProfile.objects.create(user=self.driver)
        self.owner = User.objects.create_user(
            username='rest_owner',
            password='ownerpass123',
            role=UserRole.RESTAURANT,
            phone='4434444444',
            email='owner@example.com',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Tacos Test',
            address='Calle 1',
        )
        self.client.login(username='panel_admin', password='adminpass123')

    def _make_order(self, customer):
        return Order.objects.create(
            customer=customer,
            restaurant=self.restaurant,
            status=OrderStatus.PENDING,
            delivery_address='Casa',
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('20.00'),
            total=Decimal('120.00'),
        )

    def test_list_only_customers(self):
        response = self.client.get(reverse('dashboard:customers'))
        self.assertEqual(response.status_code, 200)
        usernames = [u.username for u in response.context['customers']]
        self.assertIn('cli_uno', usernames)
        self.assertNotIn('rep_uno', usernames)
        self.assertNotIn('rest_owner', usernames)

    def test_cannot_open_driver_as_customer(self):
        response = self.client.get(
            reverse('dashboard:customer-detail', kwargs={'pk': self.driver.pk}),
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_edit_restaurant_owner_as_customer(self):
        response = self.client.get(
            reverse('dashboard:customer-edit', kwargs={'pk': self.owner.pk}),
        )
        self.assertEqual(response.status_code, 404)

    def test_create_customer_sets_role_and_no_extra_profiles(self):
        before_profiles = DeliveryProfile.objects.count()
        before_restaurants = Restaurant.objects.count()
        response = self.client.post(
            reverse('dashboard:customer-create'),
            {
                'username': 'NuevoCli',
                'first_name': 'Luis',
                'last_name': 'Pérez',
                'email': 'luis@example.com',
                'phone': '4435555555',
                'address': 'Centro',
                'password1': 'segura12345',
                'password2': 'segura12345',
                'role': UserRole.DRIVER,
                'vehicle_type': 'car',
                'restaurant_name': 'Hack',
            },
        )
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username='nuevocli')
        self.assertEqual(user.role, UserRole.CUSTOMER)
        self.assertFalse(user.is_staff)
        self.assertEqual(user.phone, '4435555555')
        self.assertFalse(DeliveryProfile.objects.filter(user=user).exists())
        self.assertFalse(Restaurant.objects.filter(owner=user).exists())
        self.assertEqual(DeliveryProfile.objects.count(), before_profiles)
        self.assertEqual(Restaurant.objects.count(), before_restaurants)

    def test_create_rejects_empty_phone(self):
        response = self.client.post(
            reverse('dashboard:customer-create'),
            {
                'username': 'sin_tel',
                'first_name': 'Sin',
                'last_name': 'Tel',
                'email': 'sintel@example.com',
                'phone': '',
                'password1': 'segura12345',
                'password2': 'segura12345',
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(username='sin_tel').exists())
        self.assertTrue(response.context['form'].errors.get('phone'))

    def test_edit_keeps_customer_role(self):
        response = self.client.post(
            reverse('dashboard:customer-edit', kwargs={'pk': self.customer.pk}),
            {
                'username': 'cli_uno',
                'first_name': 'Ana',
                'last_name': 'Actualizada',
                'email': 'ana@example.com',
                'phone': '4432222222',
                'address': 'Nueva',
                'is_active': 'on',
                'role': UserRole.ADMIN,
            },
        )
        self.assertEqual(response.status_code, 302)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, UserRole.CUSTOMER)
        self.assertEqual(self.customer.last_name, 'Actualizada')
        self.assertFalse(DeliveryProfile.objects.filter(user=self.customer).exists())

    def test_deactivate_and_activate(self):
        response = self.client.post(
            reverse('dashboard:customer-deactivate', kwargs={'pk': self.customer.pk}),
        )
        self.assertEqual(response.status_code, 302)
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

        response = self.client.post(
            reverse('dashboard:customer-activate', kwargs={'pk': self.customer.pk}),
        )
        self.assertEqual(response.status_code, 302)
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_active)

    def test_search_and_active_filter(self):
        inactive = User.objects.create_user(
            username='cli_off',
            password='clientepass123',
            role=UserRole.CUSTOMER,
            phone='4436666666',
            email='off@example.com',
            is_active=False,
        )
        response = self.client.get(reverse('dashboard:customers'), {'q': 'Ana'})
        self.assertEqual(response.status_code, 200)
        ids = [c.pk for c in response.context['customers']]
        self.assertIn(self.customer.pk, ids)
        self.assertNotIn(inactive.pk, ids)

        response = self.client.get(reverse('dashboard:customers'), {'active': '0'})
        ids = [c.pk for c in response.context['customers']]
        self.assertIn(inactive.pk, ids)
        self.assertNotIn(self.customer.pk, ids)

    def test_delete_blocked_when_orders_exist(self):
        self._make_order(self.customer)
        response = self.client.post(
            reverse('dashboard:customer-delete', kwargs={'pk': self.customer.pk}),
            {'confirm_username': 'cli_uno'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(User.objects.filter(pk=self.customer.pk).exists())

    def test_delete_requires_username_confirmation(self):
        response = self.client.post(
            reverse('dashboard:customer-delete', kwargs={'pk': self.customer.pk}),
            {'confirm_username': 'otro'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(User.objects.filter(pk=self.customer.pk).exists())

    def test_delete_without_orders(self):
        response = self.client.post(
            reverse('dashboard:customer-delete', kwargs={'pk': self.customer.pk}),
            {'confirm_username': 'cli_uno'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(User.objects.filter(pk=self.customer.pk).exists())

    def test_orders_filter_by_customer(self):
        self._make_order(self.customer)
        other = User.objects.create_user(
            username='cli_dos',
            password='clientepass123',
            role=UserRole.CUSTOMER,
            phone='4437777777',
            email='dos@example.com',
        )
        self._make_order(other)
        response = self.client.get(
            reverse('dashboard:orders'),
            {'customer': str(self.customer.pk)},
        )
        self.assertEqual(response.status_code, 200)
        customers = {o.customer_id for o in response.context['orders']}
        self.assertEqual(customers, {self.customer.pk})

    def test_anonymous_redirected(self):
        self.client.logout()
        response = self.client.get(reverse('dashboard:customers'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/panel/login/', response.url)

    def test_pagination(self):
        for i in range(30):
            User.objects.create_user(
                username=f'cli_page_{i}',
                password='clientepass123',
                role=UserRole.CUSTOMER,
                phone=f'4438888{i:03d}'[-10:],
                email=f'page{i}@example.com',
            )
        response = self.client.get(reverse('dashboard:customers'))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['is_paginated'])
        self.assertEqual(len(response.context['customers']), 25)
        response = self.client.get(reverse('dashboard:customers'), {'page': 2})
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.context['customers']), 1)

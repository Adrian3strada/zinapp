from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from accounts.models import UserRole
from orders.models import CancellationSource, Order, OrderStatus, PaymentMethod, PaymentStatus
from restaurants.models import Restaurant

User = get_user_model()


class CustomerStuckOrderReminderTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username='stuck_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
            first_name='Ana',
        )
        self.owner = User.objects.create_user(
            username='stuck_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
            first_name='Luis',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Fonda Stuck',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )

    def _order(self, **kwargs):
        defaults = {
            'customer': self.customer,
            'restaurant': self.restaurant,
            'delivery_address': 'Calle 1',
            'delivery_fee': Decimal('35.00'),
            'subtotal': Decimal('50.00'),
            'total': Decimal('85.00'),
            'status': OrderStatus.PENDING,
        }
        defaults.update(kwargs)
        return Order.objects.create(**defaults)

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_pending_notifies_customer_and_restaurant(self, mock_push):
        order = self._order()
        Order.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(minutes=9),
        )
        call_command('send_order_reminders')
        recipients = {call.args[0] for call in mock_push.call_args_list}
        self.assertIn(self.owner, recipients)
        self.assertIn(self.customer, recipients)
        customer_bodies = [
            call.args[2] for call in mock_push.call_args_list if call.args[0] == self.customer
        ]
        self.assertTrue(any('aún no confirma' in body for body in customer_bodies))

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_unpaid_transfer_nudge_asks_for_proof(self, mock_push):
        order = self._order(
            payment_method=PaymentMethod.TRANSFER,
            payment_status=PaymentStatus.PENDING,
        )
        Order.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(minutes=9),
        )
        call_command('send_order_reminders')
        recipients = {call.args[0] for call in mock_push.call_args_list}
        self.assertIn(self.owner, recipients)
        self.assertIn(self.customer, recipients)
        customer_bodies = [
            call.args[2] for call in mock_push.call_args_list if call.args[0] == self.customer
        ]
        self.assertTrue(any('transferencia' in body.lower() for body in customer_bodies))
        self.assertTrue(any('comprobante' in body.lower() for body in customer_bodies))
        self.assertFalse(any('aún no confirma' in body for body in customer_bodies))

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_unpaid_transfer_without_proof_cancels_after_timeout(self, mock_push):
        order = self._order(
            payment_method=PaymentMethod.TRANSFER,
            payment_status=PaymentStatus.PENDING,
        )
        Order.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(minutes=31),
        )
        call_command('send_order_reminders')
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.CANCELLED)
        self.assertEqual(order.cancellation_source, CancellationSource.PAYMENT_TIMEOUT)
        customer_bodies = [
            call.args[2] for call in mock_push.call_args_list if call.args[0] == self.customer
        ]
        self.assertTrue(any('canceló' in body for body in customer_bodies))
        self.assertTrue(any('WhatsApp' in body for body in customer_bodies))

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_unpaid_transfer_with_proof_does_not_cancel(self, mock_push):
        order = self._order(
            payment_method=PaymentMethod.TRANSFER,
            payment_status=PaymentStatus.PENDING,
        )
        png = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
            b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
            b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        order.payment_proof.save(
            'comprobante.png',
            SimpleUploadedFile('comprobante.png', png, content_type='image/png'),
            save=True,
        )
        Order.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(minutes=31),
        )
        call_command('send_order_reminders')
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PENDING)
        customer_bodies = [
            call.args[2] for call in mock_push.call_args_list if call.args[0] == self.customer
        ]
        self.assertTrue(any('comprobante' in body.lower() for body in customer_bodies))
        self.assertFalse(any('canceló' in body for body in customer_bodies))

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_kitchen_overdue_notifies_customer(self, mock_push):
        order = self._order(status=OrderStatus.PREPARING)
        past = timezone.now() - timedelta(minutes=6)
        Order.objects.filter(pk=order.pk).update(
            accepted_at=past,
            estimated_ready_at=past,
        )
        call_command('send_order_reminders')
        customer_bodies = [
            call.args[2] for call in mock_push.call_args_list if call.args[0] == self.customer
        ]
        self.assertTrue(any('sigue en cocina' in body for body in customer_bodies))
        order.refresh_from_db()
        self.assertTrue(order.kitchen_stale_reminder_sent)

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_ready_without_driver_escalates_to_support(self, mock_push):
        order = self._order(status=OrderStatus.READY)
        Order.objects.filter(pk=order.pk).update(
            ready_at=timezone.now() - timedelta(minutes=31),
        )
        call_command('send_order_reminders')
        order.refresh_from_db()
        self.assertTrue(order.ready_no_driver_escalated)
        customer_bodies = [
            call.args[2] for call in mock_push.call_args_list if call.args[0] == self.customer
        ]
        self.assertTrue(any('soporte' in body.lower() for body in customer_bodies))

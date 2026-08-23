import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from accounts.models import UserRole
from accounts.notifications import (
    _extract_push_ticket,
    _sanitize_provider_message,
    process_push_receipts,
    send_push_to_user,
)

User = get_user_model()

VALID_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'


class _FakeExpoResponse:
    def __init__(self, payload, status: int = 200):
        self.status = status
        self._payload = payload

    def read(self):
        if isinstance(self._payload, (bytes, bytearray)):
            return bytes(self._payload)
        if isinstance(self._payload, str):
            return self._payload.encode('utf-8')
        return json.dumps(self._payload).encode('utf-8')

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ExtractPushTicketTests(TestCase):
    def test_list_ticket(self):
        ticket = _extract_push_ticket({'data': [{'status': 'ok', 'id': 'abc'}]})
        self.assertEqual(ticket, {'status': 'ok', 'id': 'abc'})

    def test_dict_ticket(self):
        ticket = _extract_push_ticket({'data': {'status': 'ok', 'id': 'abc'}})
        self.assertEqual(ticket, {'status': 'ok', 'id': 'abc'})

    def test_empty_list(self):
        self.assertIsNone(_extract_push_ticket({'data': []}))

    def test_missing_data(self):
        self.assertIsNone(_extract_push_ticket({}))
        self.assertIsNone(_extract_push_ticket({'data': None}))

    def test_unexpected_data_type(self):
        self.assertIsNone(_extract_push_ticket({'data': 'oops'}))
        self.assertIsNone(_extract_push_ticket({'data': 1}))


class SanitizeProviderMessageTests(TestCase):
    def test_redacts_expo_token(self):
        msg = f'"{VALID_TOKEN}" is not a registered push notification recipient'
        sanitized = _sanitize_provider_message(msg)
        self.assertNotIn(VALID_TOKEN, sanitized)
        self.assertIn('ExponentPushToken[REDACTED]', sanitized)


@override_settings(PUSH_ASYNC_RECEIPT_CHECK=False)
class SendPushToUserTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='push_user',
            password='test1234',
            role=UserRole.CUSTOMER,
            expo_push_token=VALID_TOKEN,
        )

    def _send(self, mock_urlopen, payload, status=200):
        mock_urlopen.return_value = _FakeExpoResponse(payload, status=status)
        return send_push_to_user(self.user, 'Título', 'Cuerpo', {'orderId': 1})

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_success_with_list_data(self, mock_urlopen):
        ok = self._send(mock_urlopen, {
            'data': [{'status': 'ok', 'id': 'ticket-1'}],
        })
        self.assertTrue(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_success_with_dict_data(self, mock_urlopen):
        """Expo puede devolver un solo ticket como objeto, no lista."""
        ok = self._send(mock_urlopen, {
            'data': {'status': 'ok', 'id': 'ticket-1'},
        })
        self.assertTrue(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_expo_error_without_raising_keyerror(self, mock_urlopen):
        ok = self._send(mock_urlopen, {
            'data': {
                'status': 'error',
                'message': 'MessageTooBig',
                'details': {'error': 'MessageTooBig'},
            },
        })
        self.assertFalse(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_device_not_registered_clears_token(self, mock_urlopen):
        ok = self._send(mock_urlopen, {
            'data': {
                'status': 'error',
                'message': f'"{VALID_TOKEN}" is not a registered push notification recipient',
                'details': {'error': 'DeviceNotRegistered'},
            },
        })
        self.assertTrue(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, '')

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_device_not_registered_in_list(self, mock_urlopen):
        ok = self._send(mock_urlopen, {
            'data': [{
                'status': 'error',
                'message': 'Device unregistered',
                'details': {'error': 'DeviceNotRegistered'},
            }],
        })
        self.assertTrue(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, '')

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_empty_data_list_does_not_raise(self, mock_urlopen):
        ok = self._send(mock_urlopen, {'data': []})
        self.assertFalse(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_missing_data_does_not_raise(self, mock_urlopen):
        ok = self._send(mock_urlopen, {'errors': [{'code': 'UNAUTHORIZED', 'message': 'nope'}]})
        self.assertFalse(ok)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_response_without_data_key(self, mock_urlopen):
        ok = self._send(mock_urlopen, {})
        self.assertFalse(ok)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_unexpected_data_type_does_not_raise(self, mock_urlopen):
        ok = self._send(mock_urlopen, {'data': 'not-a-ticket'})
        self.assertFalse(ok)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_no_token_skips_request(self, mock_urlopen):
        self.user.expo_push_token = ''
        self.user.save(update_fields=['expo_push_token'])
        ok = send_push_to_user(self.user, 'Título', 'Cuerpo')
        self.assertTrue(ok)
        mock_urlopen.assert_not_called()

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_invalid_json_does_not_raise(self, mock_urlopen):
        ok = self._send(mock_urlopen, b'{not-json')
        self.assertFalse(ok)


@override_settings(PUSH_ASYNC_RECEIPT_CHECK=False)
class ProcessPushReceiptsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='receipt_user',
            password='test1234',
            role=UserRole.RESTAURANT,
            expo_push_token=VALID_TOKEN,
        )

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_ok_receipt_keeps_token(self, mock_urlopen):
        mock_urlopen.return_value = _FakeExpoResponse({
            'data': {'ticket-1': {'status': 'ok'}},
        })
        receipts = process_push_receipts(['ticket-1'], user_id=self.user.pk)
        self.assertEqual(receipts['ticket-1']['status'], 'ok')
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_device_not_registered_receipt_clears_token(self, mock_urlopen):
        mock_urlopen.return_value = _FakeExpoResponse({
            'data': {
                'ticket-1': {
                    'status': 'error',
                    'message': 'Not registered',
                    'details': {'error': 'DeviceNotRegistered'},
                },
            },
        })
        process_push_receipts(['ticket-1'], user_id=self.user.pk)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, '')


class NotifyOrderStatusNoiseTests(TestCase):
    def setUp(self):
        from decimal import Decimal

        from accounts.notifications import notify_order_status
        from orders.models import Order, OrderStatus, PaymentMethod, PaymentStatus
        from restaurants.models import Restaurant

        self.notify_order_status = notify_order_status
        self.OrderStatus = OrderStatus

        self.customer = User.objects.create_user(
            username='noise_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
            expo_push_token=VALID_TOKEN,
        )
        self.owner = User.objects.create_user(
            username='noise_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
            expo_push_token=VALID_TOKEN,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Noise Rest',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.PENDING,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PENDING,
            subtotal=Decimal('100.00'),
            total=Decimal('125.00'),
            delivery_address='Calle 1',
        )

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_skips_ready_and_preparing_after_accepted(self, mock_push):
        self.order.status = self.OrderStatus.READY
        self.notify_order_status(self.order, previous_status=self.OrderStatus.PREPARING)
        # Sin drivers disponibles no hay push; cliente/dueño tampoco reciben ready.
        for call in mock_push.call_args_list:
            self.assertNotEqual(call.args[0], self.customer)
            self.assertNotEqual(call.args[0], self.owner)
        self.assertEqual(mock_push.call_count, 0)

        self.order.status = self.OrderStatus.PREPARING
        self.notify_order_status(self.order, previous_status=self.OrderStatus.ACCEPTED)
        self.assertEqual(mock_push.call_count, 0)

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_pending_to_preparing_notifies_customer_once_as_accepted(self, mock_push):
        self.order.status = self.OrderStatus.PREPARING
        self.notify_order_status(self.order, previous_status=self.OrderStatus.PENDING)
        customer_calls = [
            c for c in mock_push.call_args_list if c.args[0] == self.customer
        ]
        self.assertEqual(len(customer_calls), 1)
        self.assertIn('aceptado', customer_calls[0].args[2].lower())


class RestaurantOpenOncePerDayTests(TestCase):
    def setUp(self):
        from restaurants.models import Restaurant

        self.owner = User.objects.create_user(
            username='open_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Open Rest',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )

    @patch('restaurants.open_notify.notify_restaurant_opened')
    def test_manual_toggle_respects_daily_cap(self, mock_notify):
        from django.utils import timezone

        from restaurants.open_notify import notify_restaurant_opened_if_needed

        self.assertTrue(
            notify_restaurant_opened_if_needed(self.restaurant, manual=True),
        )
        self.restaurant.refresh_from_db()
        self.assertEqual(self.restaurant.last_open_notification_date, timezone.localdate())
        self.assertFalse(
            notify_restaurant_opened_if_needed(self.restaurant, manual=True),
        )
        self.assertEqual(mock_notify.call_count, 1)

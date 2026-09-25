from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import UserRole
from orders.models import Coupon, Order, OrderSource, OrderStatus
from restaurants.models import Product, Restaurant
from rewards.models import (
    BenefitKind,
    LoyaltyProgressEvent,
    RedemptionStatus,
    RewardProgramConfig,
    RewardRedemption,
)
from rewards.services import (
    apply_checkout_benefit,
    get_program_config,
    on_order_delivered,
    record_loyalty_progress,
    user_rewards_payload,
    validate_date_of_birth,
)

User = get_user_model()


def years_ago(years: int) -> date:
    today = timezone.localdate()
    try:
        return today.replace(year=today.year - years)
    except ValueError:
        return today.replace(month=2, day=28, year=today.year - years)


class RewardsServiceTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='rew_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
        )
        self.customer = User.objects.create_user(
            username='rew_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
            email='rew_customer@example.com',
            phone='4431234567',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Fonda Rewards',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
            is_available=True,
        )
        RewardProgramConfig.objects.all().delete()
        get_program_config()

    def _deliver(self, n=1, customer=None):
        customer = customer or self.customer
        orders = []
        for _ in range(n):
            order = Order.objects.create(
                customer=customer,
                restaurant=self.restaurant,
                status=OrderStatus.PENDING,
                delivery_address='Calle 1',
                delivery_fee=Decimal('35.00'),
                subtotal=Decimal('50.00'),
                total=Decimal('85.00'),
            )
            order.status = OrderStatus.DELIVERED
            order.save(update_fields=['status'])
            orders.append(order)
        return orders

    def _post_order(self, **extra):
        self.client.force_authenticate(self.customer)
        payload = {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1',
            'delivery_latitude': '19.860000',
            'delivery_longitude': '-100.820000',
            'payment_method': 'cash',
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }
        payload.update(extra)
        return self.client.post('/api/orders/', payload, format='json')

    def test_zero_orders(self):
        data = user_rewards_payload(self.customer)
        self.assertEqual(data['loyalty']['completed_in_cycle'], 0)
        self.assertFalse(data['loyalty']['unlocked'])
        self.assertFalse(data['next_checkout']['eligible'])

    def test_four_completed_orders(self):
        self._deliver(4)
        data = user_rewards_payload(self.customer)
        self.assertEqual(data['loyalty']['completed_in_cycle'], 4)
        self.assertEqual(data['loyalty']['remaining'], 1)
        self.assertFalse(data['loyalty']['unlocked'])

    def test_fifth_completed_unlocks(self):
        self._deliver(5)
        data = user_rewards_payload(self.customer)
        self.assertEqual(data['loyalty']['completed_in_cycle'], 5)
        self.assertTrue(data['loyalty']['unlocked'])

    def test_sixth_order_gets_free_delivery(self):
        self._deliver(5)
        resp = self._post_order()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data['applied_benefit'], BenefitKind.LOYALTY)
        self.assertEqual(resp.data['delivery_fee'], '35.00')
        self.assertEqual(resp.data['delivery_discount'], '35.00')
        self.assertIn('Envío gratis', resp.data['applied_benefit_label'])
        payable = Decimal(resp.data['subtotal']) + Decimal('0.00')
        self.assertEqual(Decimal(resp.data['total']), payable)

    def test_after_free_order_progress_resets(self):
        self._deliver(5)
        resp = self._post_order()
        order = Order.objects.get(pk=resp.data['id'])
        order.status = OrderStatus.DELIVERED
        order.save(update_fields=['status'])
        data = user_rewards_payload(self.customer)
        self.assertEqual(data['loyalty']['completed_in_cycle'], 0)
        self.assertFalse(data['loyalty']['unlocked'])

    def test_cancelled_order_does_not_count(self):
        order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.PENDING,
            delivery_address='Calle 1',
            delivery_fee=Decimal('35.00'),
            subtotal=Decimal('50.00'),
            total=Decimal('85.00'),
        )
        order.status = OrderStatus.CANCELLED
        order.save(update_fields=['status'])
        data = user_rewards_payload(self.customer)
        self.assertEqual(data['loyalty']['completed_in_cycle'], 0)
        self.assertEqual(LoyaltyProgressEvent.objects.filter(user=self.customer).count(), 0)

    def test_same_order_does_not_double_count(self):
        order = self._deliver(1)[0]
        record_loyalty_progress(order)
        record_loyalty_progress(order)
        on_order_delivered(order)
        self.assertEqual(LoyaltyProgressEvent.objects.filter(order=order).count(), 1)

    def test_birthday_applies_once(self):
        self.customer.date_of_birth = years_ago(25)
        self.customer.save(update_fields=['date_of_birth'])
        first = self._post_order()
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data['applied_benefit'], BenefitKind.BIRTHDAY)
        second = self._post_order()
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(second.data.get('applied_benefit') or '', '')
        self.assertEqual(second.data['delivery_discount'], '0.00')

    def test_no_birthday_no_birthday_benefit(self):
        resp = self._post_order()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data.get('applied_benefit') or '', '')

    def test_birthday_wins_over_loyalty(self):
        self._deliver(5)
        self.customer.date_of_birth = years_ago(25)
        self.customer.save(update_fields=['date_of_birth'])
        resp = self._post_order()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data['applied_benefit'], BenefitKind.BIRTHDAY)
        data = user_rewards_payload(self.customer)
        self.assertTrue(data['loyalty']['unlocked'])

    def test_cap_limits_discount(self):
        cfg = get_program_config()
        cfg.delivery_discount_cap = Decimal('25.00')
        cfg.save()
        self._deliver(5)
        resp = self._post_order()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data['delivery_fee'], '35.00')
        self.assertEqual(resp.data['delivery_discount'], '25.00')
        self.assertEqual(
            Decimal(resp.data['total']),
            Decimal(resp.data['subtotal']) + Decimal('10.00'),
        )

    def test_zero_delivery_does_not_consume(self):
        order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.PENDING,
            source=OrderSource.ZINAPP,
            delivery_address='Calle 1',
            delivery_fee=Decimal('0.00'),
            subtotal=Decimal('50.00'),
            total=Decimal('50.00'),
        )
        self._deliver(5)
        applied = apply_checkout_benefit(order)
        self.assertIsNone(applied)
        self.assertEqual(RewardRedemption.objects.filter(user=self.customer).count(), 0)

    def test_envio0_skips_zinapp_benefit(self):
        Coupon.objects.create(
            code='ENVIO0',
            discount_fixed=Decimal('35.00'),
            is_active=True,
        )
        self._deliver(5)
        resp = self._post_order(coupon_code='ENVIO0')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data.get('applied_benefit') or '', '')
        data = user_rewards_payload(self.customer)
        self.assertTrue(data['loyalty']['unlocked'])

    def test_cancelled_reserved_benefit_can_be_reused(self):
        self._deliver(5)
        resp = self._post_order()
        order = Order.objects.get(pk=resp.data['id'])
        self.assertEqual(order.applied_benefit, BenefitKind.LOYALTY)
        order.status = OrderStatus.CANCELLED
        order.save(update_fields=['status'])
        data = user_rewards_payload(self.customer)
        self.assertTrue(data['loyalty']['unlocked'])
        again = self._post_order()
        self.assertEqual(again.data['applied_benefit'], BenefitKind.LOYALTY)

    def test_rewards_endpoint(self):
        self.client.force_authenticate(self.customer)
        resp = self.client.get('/api/rewards/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['loyalty']['completed_in_cycle'], 0)

    def test_birthday_change_cooldown(self):
        self.client.force_authenticate(self.customer)
        dob = years_ago(20)
        first = self.client.patch('/api/auth/me/', {'date_of_birth': dob.isoformat()}, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        other = dob.replace(year=dob.year - 1) if dob.month != 2 or dob.day != 29 else years_ago(21)
        second = self.client.patch(
            '/api/auth/me/',
            {'date_of_birth': other.isoformat()},
            format='json',
        )
        self.assertEqual(second.status_code, 400)

    def test_future_birthday_rejected(self):
        self.client.force_authenticate(self.customer)
        future = timezone.localdate() + timedelta(days=1)
        resp = self.client.patch(
            '/api/auth/me/',
            {'date_of_birth': future.isoformat()},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_config_exposes_rewards(self):
        resp = self.client.get('/api/config/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('rewards', resp.json())
        self.assertEqual(resp.json()['rewards']['loyalty_orders_required'], 5)


class BirthdayValidationUnitTests(TestCase):
    def test_min_age(self):
        user = User(date_of_birth=None)
        too_young = years_ago(10)
        with self.assertRaises(Exception):
            validate_date_of_birth(user, too_young)


class ReferralTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='ref_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
        )
        self.referrer = User.objects.create_user(
            username='ref_padrino',
            password='test1234',
            role=UserRole.CUSTOMER,
            email='padrino@example.com',
        )
        self.invitee = User.objects.create_user(
            username='ref_invitee',
            password='test1234',
            role=UserRole.CUSTOMER,
            email='invitee@example.com',
            phone='4431234567',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Fonda Ref',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('50.00'),
            is_available=True,
        )
        RewardProgramConfig.objects.all().delete()
        get_program_config()

    def test_register_applies_code_and_invitee_gets_free_delivery(self):
        from rewards.services import apply_referral_code

        apply_referral_code(self.invitee, self.referrer.referral_code)
        self.invitee.refresh_from_db()
        self.assertEqual(self.invitee.referred_by_id, self.referrer.id)

        self.client.force_authenticate(self.invitee)
        resp = self.client.post('/api/orders/', {
            'restaurant_id': self.restaurant.id,
            'delivery_address': 'Calle 1',
            'delivery_latitude': '19.860000',
            'delivery_longitude': '-100.820000',
            'payment_method': 'cash',
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data['applied_benefit'], 'referral_invitee')
        self.assertEqual(resp.data['delivery_discount'], '35.00')

    def test_referrer_gets_credit_after_first_delivery(self):
        from rewards.models import ReferralCredit
        from rewards.services import apply_referral_code

        apply_referral_code(self.invitee, self.referrer.referral_code)
        order = Order.objects.create(
            customer=self.invitee,
            restaurant=self.restaurant,
            delivery_address='Calle 1',
            delivery_fee=Decimal('35.00'),
            subtotal=Decimal('50.00'),
            total=Decimal('85.00'),
        )
        order.status = OrderStatus.DELIVERED
        order.save(update_fields=['status'])
        self.assertTrue(
            ReferralCredit.objects.filter(user=self.referrer, from_user=self.invitee).exists()
        )
        payload = user_rewards_payload(self.referrer)
        self.assertGreaterEqual(payload['referral']['credits'], 1)

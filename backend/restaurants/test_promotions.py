from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from restaurants.models import Product, ProductPromotion, PromoType, Restaurant
from restaurants.promotions import calculate_promo_line_total, get_active_promotion

User = get_user_model()


class ProductPromotionTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='promo_owner',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Promo Test',
            address='Centro, Zinapécuaro',
            is_active=True,
            accepting_orders=True,
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('30.00'),
            is_available=True,
        )

    def test_two_for_one_charges_half_rounded_up(self):
        promo = ProductPromotion.objects.create(
            restaurant=self.restaurant,
            product=self.product,
            promo_type=PromoType.TWO_FOR_ONE,
            valid_until=timezone.now() + timedelta(days=1),
        )
        self.assertIsNotNone(get_active_promotion(self.product))
        total, matched = calculate_promo_line_total(self.product, 2)
        self.assertEqual(matched, promo)
        self.assertEqual(total, Decimal('30.00'))
        total_four, _ = calculate_promo_line_total(self.product, 4)
        self.assertEqual(total_four, Decimal('60.00'))

    def test_percent_off(self):
        ProductPromotion.objects.create(
            restaurant=self.restaurant,
            product=self.product,
            promo_type=PromoType.PERCENT_OFF,
            percent_off=20,
            valid_until=timezone.now() + timedelta(days=1),
        )
        total, _ = calculate_promo_line_total(self.product, 2)
        self.assertEqual(total, Decimal('48.00'))

    def test_expired_promo_not_applied(self):
        ProductPromotion.objects.create(
            restaurant=self.restaurant,
            product=self.product,
            promo_type=PromoType.TWO_FOR_ONE,
            valid_until=timezone.now() - timedelta(hours=1),
        )
        self.assertIsNone(get_active_promotion(self.product))
        total, promo = calculate_promo_line_total(self.product, 2)
        self.assertIsNone(promo)
        self.assertEqual(total, Decimal('60.00'))

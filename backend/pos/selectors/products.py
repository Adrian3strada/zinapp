from restaurants.models import PRODUCT_CATEGORY_ORDER, Product, ProductCategory


def products_for_pos(restaurant, *, search: str = '', category: str = ''):
    qs = (
        Product.objects.filter(restaurant=restaurant, is_available=True)
        .prefetch_related('option_groups__options')
        .order_by('category', 'name')
    )
    if category:
        qs = qs.filter(category=category)
    if search:
        qs = qs.filter(name__icontains=search.strip())
    return qs


def category_choices_for_restaurant(restaurant):
    present = set(
        Product.objects.filter(restaurant=restaurant, is_available=True)
        .values_list('category', flat=True)
        .distinct()
    )
    ordered = [c for c in PRODUCT_CATEGORY_ORDER if c in present]
    labels = dict(ProductCategory.choices)
    return [(c, labels.get(c, c)) for c in ordered]

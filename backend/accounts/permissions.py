from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import UserRole


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_admin_user
        )


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_customer
        )


class IsRestaurantOwner(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_restaurant_owner
        )


class IsRestaurantOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (request.user.is_restaurant_owner or request.user.is_admin_user)
        )


class IsDriver(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_driver
        )


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_admin_user
        )


class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_admin_user:
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        if hasattr(obj, 'customer'):
            return obj.customer == request.user
        if hasattr(obj, 'driver') and obj.driver_id:
            return obj.driver == request.user
        restaurant = getattr(obj, 'restaurant', None)
        if restaurant is not None and hasattr(restaurant, 'owner_id'):
            return restaurant.owner == request.user
        return False

from django.urls import path

from . import views

app_name = 'dashboard'

urlpatterns = [
    path('login/', views.PanelLoginView.as_view(), name='login'),
    path('logout/', views.panel_logout, name='logout'),
    path('', views.DashboardHomeView.as_view(), name='home'),
    path('pedidos/', views.OrderListView.as_view(), name='orders'),
    path('pedidos/<int:pk>/', views.OrderDetailView.as_view(), name='order-detail'),
    path('restaurantes/', views.RestaurantListView.as_view(), name='restaurants'),
    path('restaurantes/<int:pk>/', views.RestaurantDetailView.as_view(), name='restaurant-detail'),
    path(
        'restaurantes/<int:pk>/toggle-active/',
        views.RestaurantToggleActiveView.as_view(),
        name='restaurant-toggle-active',
    ),
    path(
        'restaurantes/<int:pk>/toggle-orders/',
        views.RestaurantToggleOrdersView.as_view(),
        name='restaurant-toggle-orders',
    ),
    path('usuarios/', views.UserListView.as_view(), name='users'),
    path('repartidores/', views.DriverListView.as_view(), name='drivers'),
]

from django.urls import path

from . import views

urlpatterns = [
    path('', views.CustomerListView.as_view(), name='customers'),
    path('nuevo/', views.CustomerCreateView.as_view(), name='customer-create'),
    path('<int:pk>/', views.CustomerDetailView.as_view(), name='customer-detail'),
    path('<int:pk>/editar/', views.CustomerUpdateView.as_view(), name='customer-edit'),
    path('<int:pk>/activar/', views.CustomerActivateView.as_view(), name='customer-activate'),
    path('<int:pk>/desactivar/', views.CustomerDeactivateView.as_view(), name='customer-deactivate'),
    path('<int:pk>/eliminar/', views.CustomerDeleteView.as_view(), name='customer-delete'),
]

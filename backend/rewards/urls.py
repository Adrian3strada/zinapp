from django.urls import path

from .views import MyRewardsView

urlpatterns = [
    path('rewards/', MyRewardsView.as_view(), name='my-rewards'),
]

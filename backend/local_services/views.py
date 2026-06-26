from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import LocalService
from .serializers import LocalServiceSerializer


class LocalServiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LocalServiceSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return LocalService.objects.filter(is_active=True).order_by('sort_order', 'name')

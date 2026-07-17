from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import LocalService, LocalServiceCategory
from .serializers import LocalServiceSerializer


class LocalServiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LocalServiceSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = LocalService.objects.filter(is_active=True).order_by('sort_order', 'name')
        category = (self.request.query_params.get('category') or '').strip()
        if category and category in LocalServiceCategory.values:
            qs = qs.filter(category=category)
        return qs

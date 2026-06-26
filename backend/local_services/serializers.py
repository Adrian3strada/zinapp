from rest_framework import serializers

from .models import LocalService


def build_logo_url(obj, request):
    if not obj.logo:
        return None
    if request:
        return request.build_absolute_uri(obj.logo.url)
    return obj.logo.url


class LocalServiceSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = LocalService
        fields = (
            'id',
            'name',
            'category',
            'category_display',
            'description',
            'logo',
            'logo_url',
            'address',
            'schedule',
            'phone',
            'whatsapp',
            'instagram',
            'facebook',
            'is_active',
            'sort_order',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_logo_url(self, obj):
        return build_logo_url(obj, self.context.get('request'))

from rest_framework import serializers

from config.absolute_uri import public_absolute_uri

from .models import LocalService


def build_logo_url(obj, request):
    if not obj.logo:
        return None
    url = obj.logo.url
    if url and not url.startswith(('http://', 'https://', '/')):
        url = f'/{url}'
    return public_absolute_uri(request, url)


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

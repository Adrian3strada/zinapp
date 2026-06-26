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

    class Meta:
        model = LocalService
        fields = (
            'id',
            'name',
            'description',
            'logo',
            'logo_url',
            'phone',
            'whatsapp',
            'is_active',
            'sort_order',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_logo_url(self, obj):
        return build_logo_url(obj, self.context.get('request'))

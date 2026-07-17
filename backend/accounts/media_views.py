from django.conf import settings
from django.http import Http404
from django.views.static import serve


PRIVATE_MEDIA_PREFIXES = ('driver_documents/',)


def serve_media(request, path):
    """Serve public media while keeping identity documents panel-only.

    Production deployments should preferably serve public media from object
    storage/CDN and keep this fallback disabled. This view is intentionally
    narrow so a predictable document URL cannot bypass authorization.
    """
    if path.startswith(PRIVATE_MEDIA_PREFIXES):
        user = request.user
        if not user.is_authenticated or not user.is_admin_user:
            raise Http404
    return serve(request, path, document_root=settings.MEDIA_ROOT)

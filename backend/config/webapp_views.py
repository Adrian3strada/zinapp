import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import redirect
from django.views.decorators.http import require_GET

mimetypes.add_type('font/ttf', '.ttf')
mimetypes.add_type('font/woff', '.woff')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('application/manifest+json', '.webmanifest')

STATIC_ASSET_EXTENSIONS = (
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
    '.ttf', '.woff', '.woff2', '.wav', '.mp3', '.json', '.webmanifest', '.svg',
)


def _webapp_root() -> Path:
    return Path(settings.BASE_DIR) / 'static' / 'webapp'


def _open_file_response(path: Path, cache_control: str) -> FileResponse:
    content_type, _ = mimetypes.guess_type(str(path))
    response = FileResponse(path.open('rb'), content_type=content_type or 'application/octet-stream')
    response['Cache-Control'] = cache_control
    return response


def _is_static_asset(path: str) -> bool:
    lower = path.lower()
    return any(lower.endswith(ext) for ext in STATIC_ASSET_EXTENSIONS)


@require_GET
def webapp_redirect(_request):
    return redirect('/app/', permanent=False)


@require_GET
def webapp_serve(request, path=''):
    root = _webapp_root().resolve()
    if not root.is_dir():
        raise Http404('App web no desplegada. Ejecuta mobile/scripts/build-web.ps1')

    clean = (path or '').strip('/') or 'index.html'
    target = (root / clean).resolve()

    if not str(target).startswith(str(root)):
        raise Http404()

    if target.is_file():
        cache = (
            'public, max-age=31536000, immutable'
            if '/_expo/' in clean or clean.endswith(('.ico', '.ttf', '.woff', '.woff2', '.png', '.jpg', '.jpeg', '.webp'))
            else 'public, max-age=3600'
        )
        return _open_file_response(target, cache)

    # Solo rutas de la SPA vuelven a index.html; assets faltantes -> 404 real
    index = root / 'index.html'
    if index.is_file() and not _is_static_asset(clean):
        return _open_file_response(index, 'no-cache')

    raise Http404()

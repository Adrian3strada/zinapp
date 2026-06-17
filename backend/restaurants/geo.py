"""Utilidades de geocodificación y zona de cobertura (Zinapécuaro, Michoacán)."""

from .zinapecuaro_places import lookup_local_place

import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from decimal import ROUND_HALF_UP, Decimal

# Límites de Zinapécuaro de Figueroa (OSM / Nominatim)
ZINAPECUARO_BOUNDS = {
    'min_lat': 19.81,
    'max_lat': 19.91,
    'min_lon': -100.88,
    'max_lon': -100.78,
}

LOCATION_SUFFIX = 'Zinapécuaro, Michoacán, México'
VIEWBOX = (
    f"{ZINAPECUARO_BOUNDS['min_lon']},"
    f"{ZINAPECUARO_BOUNDS['max_lat']},"
    f"{ZINAPECUARO_BOUNDS['max_lon']},"
    f"{ZINAPECUARO_BOUNDS['min_lat']}"
)


def round_coordinate(value) -> Decimal | None:
    if value is None or value == '':
        return None
    return Decimal(str(value)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)


def is_in_coverage(latitude: float, longitude: float) -> bool:
    return (
        ZINAPECUARO_BOUNDS['min_lat'] <= latitude <= ZINAPECUARO_BOUNDS['max_lat']
        and ZINAPECUARO_BOUNDS['min_lon'] <= longitude <= ZINAPECUARO_BOUNDS['max_lon']
    )


def _normalize_address(address: str) -> str:
    cleaned = ' '.join(address.split()).strip()
    cleaned = re.sub(r',?\s*(zinap[eé]cuaro|michoac[aá]n|m[eé]xico)\s*$', '', cleaned, flags=re.I)
    return cleaned.strip(' ,')


def _address_queries(address: str) -> list[tuple[str, bool]]:
    """Genera variantes de búsqueda. El bool indica si el resultado sería aproximado."""
    addr = _normalize_address(address)
    if not addr:
        return []

    queries: list[tuple[str, bool]] = [
        (f'{addr}, {LOCATION_SUFFIX}', False),
    ]

    lower = addr.lower()
    if re.match(r'^(las?|los?|la|el)\s+', lower):
        queries.append((f'Colonia {addr}, {LOCATION_SUFFIX}', True))
        name = re.sub(r'^(las?|los?|la|el)\s+', '', addr, flags=re.I).strip()
        if name and name.lower() != addr.lower():
            queries.append((f'Colonia {name}, {LOCATION_SUFFIX}', True))

    if not lower.startswith(('calle ', 'av. ', 'av ', 'avenida ', 'boulevard ', 'blvd ')):
        queries.append((f'Calle {addr}, {LOCATION_SUFFIX}', False))

    # "Sirani 11 Felix Ireta" → probar calle+número y colonia por separado
    street_colonia = re.match(r'^(.+?\d+)\s+(.+)$', addr)
    if street_colonia:
        street_part = street_colonia.group(1).strip()
        colonia_part = street_colonia.group(2).strip()
        queries.extend([
            (f'{street_part}, {LOCATION_SUFFIX}', True),
            (f'Calle {street_part}, {LOCATION_SUFFIX}', True),
            (f'{street_part}, Colonia {colonia_part}, {LOCATION_SUFFIX}', True),
            (f'Calle {street_part}, Colonia {colonia_part}, {LOCATION_SUFFIX}', True),
            (f'Colonia {colonia_part}, {LOCATION_SUFFIX}', True),
            (f'Calle {colonia_part}, {LOCATION_SUFFIX}', True),
        ])
    elif re.search(r'\d', addr):
        queries.extend([
            (f'Calle {addr}, {LOCATION_SUFFIX}', True),
            (f'{addr}, Colonia, {LOCATION_SUFFIX}', True),
        ])
    else:
        queries.extend([
            (f'Colonia {addr}, {LOCATION_SUFFIX}', True),
            (f'Calle {addr}, {LOCATION_SUFFIX}', True),
        ])

    seen: set[str] = set()
    unique: list[tuple[str, bool]] = []
    for query, approximate in queries:
        key = query.lower()
        if key not in seen:
            seen.add(key)
            unique.append((query, approximate))
    return unique


_NOMINATIM_MIN_INTERVAL = 1.05
_last_nominatim_call = 0.0


def _rate_limit_nominatim() -> None:
    global _last_nominatim_call
    elapsed = time.monotonic() - _last_nominatim_call
    if elapsed < _NOMINATIM_MIN_INTERVAL:
        time.sleep(_NOMINATIM_MIN_INTERVAL - elapsed)
    _last_nominatim_call = time.monotonic()


def _nominatim_search(query: str, limit: int = 5) -> list[dict]:
    _rate_limit_nominatim()
    params = urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'limit': limit,
        'countrycodes': 'mx',
        'viewbox': VIEWBOX,
        'bounded': '0',
        'addressdetails': '1',
    })
    url = f'https://nominatim.openstreetmap.org/search?{params}'
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'ZinApp/1.0 (contact: admin@zinapp.test)',
            'Accept-Language': 'es',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, OSError):
        return []
    return data if isinstance(data, list) else []


def _photon_search(query: str, limit: int = 5) -> list[dict]:
    """Respaldo cuando Nominatim bloquea o no responde (p. ej. IP de Railway)."""
    params = urllib.parse.urlencode({
        'q': query,
        'limit': limit,
        'lat': '19.8581',
        'lon': '-100.8274',
    })
    url = f'https://photon.komoot.io/api/?{params}'
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'ZinApp/1.0 (delivery app)'},
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            payload = json.loads(resp.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, OSError):
        return []

    features = payload.get('features') if isinstance(payload, dict) else []
    results: list[dict] = []
    for feature in features or []:
        if not isinstance(feature, dict):
            continue
        coords = feature.get('geometry', {}).get('coordinates') or []
        if len(coords) < 2:
            continue
        props = feature.get('properties') or {}
        parts = [
            props.get('name'),
            props.get('street'),
            props.get('city') or props.get('town') or props.get('village'),
            props.get('state'),
            props.get('country'),
        ]
        display = ', '.join(p for p in parts if p)
        results.append({
            'lat': coords[1],
            'lon': coords[0],
            'display_name': display or query,
            'importance': 0.5,
        })
    return results


def _search_geocoder(query: str, limit: int = 5) -> list[dict]:
    results = _nominatim_search(query, limit=limit)
    if results:
        return results
    return _photon_search(query, limit=limit)


def _score_result(result: dict, query: str) -> float:
    try:
        lat = float(result['lat'])
        lon = float(result['lon'])
    except (KeyError, TypeError, ValueError):
        return -1

    score = float(result.get('importance', 0)) * 10
    if is_in_coverage(lat, lon):
        score += 100

    display = (result.get('display_name') or '').lower()
    query_tokens = [t for t in re.split(r'[\s,]+', query.lower()) if len(t) > 2]
    for token in query_tokens[:4]:
        if token in display:
            score += 8

    if 'zinapécuaro' in display or 'zinapecuaro' in display:
        score += 15

    return score


def geocode_address(address: str) -> dict | None:
    """Geocodifica direcciones en Zinapécuaro (gazetteer local + Nominatim + Photon)."""
    local = lookup_local_place(address)
    if local:
        lat = float(round_coordinate(local[0]))
        lon = float(round_coordinate(local[1]))
        if is_in_coverage(lat, lon):
            return {
                'latitude': lat,
                'longitude': lon,
                'display_name': local[2],
                'in_coverage': True,
                'approximate': True,
            }

    queries = _address_queries(address)
    if not queries:
        return None

    best: dict | None = None
    best_score = -1.0
    best_approximate = True

    for query, approximate in queries:
        for result in _search_geocoder(query):
            score = _score_result(result, query)
            if score > best_score:
                best_score = score
                best = result
                best_approximate = approximate

        # Si la primera búsqueda exacta ya dio resultado en cobertura, no seguir
        if not approximate and best and best_score >= 100:
            break

    if not best or 'lat' not in best or 'lon' not in best:
        return None

    lat = float(round_coordinate(best['lat']))
    lon = float(round_coordinate(best['lon']))
    in_coverage = is_in_coverage(lat, lon)

    if not in_coverage:
        return None

    return {
        'latitude': lat,
        'longitude': lon,
        'display_name': best.get('display_name', address),
        'in_coverage': True,
        'approximate': best_approximate,
    }


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _estimate_road_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    straight = haversine_meters(lat1, lon1, lat2, lon2)
    return straight * 1.35


def _estimate_driving_duration_seconds(distance_meters: float) -> float:
    # ~25 km/h promedio urbano
    speed_mps = 25_000 / 3600
    return max(60.0, distance_meters / speed_mps)


_ROUTE_CACHE: dict[str, tuple[float, dict]] = {}
_ROUTE_CACHE_TTL = 300
_ROUTE_CACHE_MAX = 200


def _route_cache_key(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    return f'{round(lat1, 4)},{round(lon1, 4)}|{round(lat2, 4)},{round(lon2, 4)}'


def _route_cache_get(key: str) -> dict | None:
    entry = _ROUTE_CACHE.get(key)
    if not entry:
        return None
    expires_at, payload = entry
    if time.monotonic() > expires_at:
        _ROUTE_CACHE.pop(key, None)
        return None
    return payload


def _route_cache_set(key: str, payload: dict) -> None:
    if len(_ROUTE_CACHE) >= _ROUTE_CACHE_MAX:
        oldest = min(_ROUTE_CACHE, key=lambda k: _ROUTE_CACHE[k][0])
        _ROUTE_CACHE.pop(oldest, None)
    _ROUTE_CACHE[key] = (time.monotonic() + _ROUTE_CACHE_TTL, payload)


def driving_route(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> dict:
    """Ruta por calles entre dos puntos (OSRM / OpenStreetMap)."""
    cache_key = _route_cache_key(lat1, lon1, lat2, lon2)
    cached = _route_cache_get(cache_key)
    if cached:
        return cached

    fallback_coords = [
        {'latitude': lat1, 'longitude': lon1},
        {'latitude': lat2, 'longitude': lon2},
    ]
    fallback_distance = _estimate_road_distance_meters(lat1, lon1, lat2, lon2)

    def _fallback() -> dict:
        return {
            'coordinates': fallback_coords,
            'distance_meters': round(fallback_distance, 1),
            'duration_seconds': round(_estimate_driving_duration_seconds(fallback_distance), 1),
            'is_fallback': True,
        }

    if lat1 == lat2 and lon1 == lon2:
        result = {
            'coordinates': fallback_coords,
            'distance_meters': 0.0,
            'duration_seconds': 0.0,
            'is_fallback': False,
        }
        _route_cache_set(cache_key, result)
        return result

    url = (
        'https://router.project-osrm.org/route/v1/driving/'
        f'{lon1:.6f},{lat1:.6f};{lon2:.6f},{lat2:.6f}'
        '?overview=full&geometries=geojson'
    )
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'ZinApp/1.0 (delivery routing)'},
            method='GET',
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            payload = json.loads(resp.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, KeyError):
        return _fallback()

    routes = payload.get('routes') or []
    if not routes:
        return _fallback()

    route = routes[0]
    geometry = route.get('geometry') or {}
    raw_coords = geometry.get('coordinates') or []
    if len(raw_coords) < 2:
        return _fallback()

    coordinates = [
        {'latitude': float(point[1]), 'longitude': float(point[0])}
        for point in raw_coords
        if isinstance(point, (list, tuple)) and len(point) >= 2
    ]
    if len(coordinates) < 2:
        return _fallback()

    distance = route.get('distance')
    duration = route.get('duration')
    result = {
        'coordinates': coordinates,
        'distance_meters': round(float(distance), 1) if distance is not None else round(fallback_distance, 1),
        'duration_seconds': round(float(duration), 1) if duration is not None else round(_estimate_driving_duration_seconds(fallback_distance), 1),
        'is_fallback': False,
    }
    _route_cache_set(cache_key, result)
    return result

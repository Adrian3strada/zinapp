"""Colonias y puntos de referencia de Zinapécuaro (coords aprox. del INEGI / SEPOM)."""

from __future__ import annotations

import re
import unicodedata

# lat, lon, nombre para display
ZINAPECUARO_PLACES: dict[str, tuple[float, float, str]] = {
    '12 de diciembre': (19.864265, -100.824823, 'Colonia 12 de Diciembre'),
    '20 de noviembre': (19.863700, -100.820093, 'Colonia 20 de Noviembre'),
    'arboledas': (19.863801, -100.830261, 'Colonia Arboledas'),
    'atzimba': (19.859939, -100.825890, 'Colonia Atzimba'),
    'bella vista': (19.855701, -100.830179, 'Colonia Bella Vista'),
    'centro': (19.859939, -100.825890, 'Zinapécuaro de Figueroa Centro'),
    'clavellinas': (19.857657, -100.834379, 'Colonia Clavellinas'),
    'cristo rey': (19.855850, -100.817133, 'Colonia Cristo Rey'),
    'el desierto': (19.859939, -100.825890, 'Colonia El Desierto'),
    'el puerto': (19.854444, -100.840556, 'Colonia El Puerto'),
    'el seguro': (19.859939, -100.825890, 'Colonia El Seguro'),
    'emiliano zapata': (19.868575, -100.819873, 'Colonia Emiliano Zapata'),
    'felix ireta': (19.865635, -100.836926, 'Colonia Félix Ireta'),
    'félix ireta': (19.865635, -100.836926, 'Colonia Félix Ireta'),
    'francisco i madero': (19.854148, -100.816857, 'Colonia Francisco I. Madero'),
    'independencia': (19.868860, -100.830532, 'Colonia Independencia'),
    'la mora': (19.854975, -100.823657, 'Colonia La Mora'),
    'las canoas': (19.846822, -100.831567, 'Colonia Las Canoas'),
    'las galeras': (19.859939, -100.825890, 'Colonia Las Galeras'),
    'las tinajas': (19.872778, -100.814167, 'Colonia Las Tinajas'),
    'lazaro cardenas': (19.854375, -100.833622, 'Colonia Lázaro Cárdenas'),
    'lázaro cárdenas': (19.854375, -100.833622, 'Colonia Lázaro Cárdenas'),
    'los fresnos': (19.859939, -100.825890, 'Colonia Los Fresnos'),
    'los parajes': (19.862700, -100.832009, 'Colonia Los Parajes'),
    'los pocitos': (19.859939, -100.825890, 'Colonia Los Pocitos'),
    'los positos': (19.859939, -100.825890, 'Colonia Los Positos'),
    'miguel hinojosa': (19.861935, -100.816483, 'Colonia Miguel Hinojosa'),
    'revolucion': (19.866022, -100.817036, 'Colonia Revolución'),
    'revolución': (19.866022, -100.817036, 'Colonia Revolución'),
    'san carlos': (19.841536, -100.816633, 'Colonia San Carlos'),
    'san juan': (19.866585, -100.819441, 'Colonia San Juan'),
    'tierras coloradas': (19.867661, -100.823573, 'Colonia Tierras Coloradas'),
    'vasco de quiroga': (19.865420, -100.830093, 'Colonia Vasco de Quiroga'),
    'zinapécuaro de figueroa centro': (19.859939, -100.825890, 'Zinapécuaro de Figueroa Centro'),
    'zinapecuaro de figueroa centro': (19.859939, -100.825890, 'Zinapécuaro de Figueroa Centro'),
}

# Alias informales (nombres como los dice la gente en el pueblo)
PLACE_ALIASES: dict[str, str] = {
    'los pocitos centro': 'los pocitos',
    'hidalgo centro': 'centro',
    'centro zinapécuaro': 'centro',
    'centro zinapecuaro': 'centro',
    'ireta': 'felix ireta',
    'felix ireta viveros': 'felix ireta',
}


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize('NFD', text)
    return ''.join(ch for ch in normalized if unicodedata.category(ch) != 'Mn')


def normalize_place_key(text: str) -> str:
    cleaned = _strip_accents(text.lower())
    cleaned = re.sub(r'^(colonia|col\.?|fracc\.?|fraccionamiento)\s+', '', cleaned)
    cleaned = re.sub(r'^(las?|los?|la|el)\s+', '', cleaned)
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', cleaned)
    cleaned = ' '.join(cleaned.split())
    return cleaned


def lookup_local_place(address: str) -> tuple[float, float, str] | None:
    """Busca colonia conocida por nombre o alias (sin geocoder externo)."""
    raw = ' '.join(address.split()).strip()
    if not raw:
        return None

    lower = _strip_accents(raw.lower())
    if lower in PLACE_ALIASES:
        lower = PLACE_ALIASES[lower]

    keys_to_try = [
        lower,
        normalize_place_key(raw),
        normalize_place_key(lower),
    ]
    if lower.startswith('colonia '):
        keys_to_try.append(normalize_place_key(lower[8:]))

    seen: set[str] = set()
    for key in keys_to_try:
        if not key or key in seen:
            continue
        seen.add(key)
        if key in ZINAPECUARO_PLACES:
            return ZINAPECUARO_PLACES[key]

    norm = normalize_place_key(raw)
    if len(norm) >= 4:
        for place_key, coords in ZINAPECUARO_PLACES.items():
            if norm in place_key or place_key in norm:
                return coords

    return None

import type { MapCoordinate } from './maps';

export type OsmPinType = 'restaurant' | 'delivery' | 'driver' | 'pickup' | 'me';

export interface OsmMapMarker {
  id: string;
  coordinate: MapCoordinate;
  color?: string;
  label?: string;
  pinType?: OsmPinType;
  /** Pulso animado (repartidor en vivo). */
  pulse?: boolean;
}

export interface OsmMapPolyline {
  coordinates: MapCoordinate[];
  color?: string;
}

export interface OsmMapLiveData {
  markers?: OsmMapMarker[];
  polylines?: OsmMapPolyline[];
  followMarkerId?: string | null;
  fitAll?: boolean;
}

interface BuildOsmMapHtmlOptions {
  center: MapCoordinate;
  zoom?: number;
  markers?: OsmMapMarker[];
  polylines?: OsmMapPolyline[];
  interactive?: boolean;
  pinCoordinate?: MapCoordinate | null;
  followMarkerId?: string | null;
}

export function buildOsmMapLivePayload(data: OsmMapLiveData): string {
  return JSON.stringify({
    markers: data.markers ?? [],
    polylines: data.polylines ?? [],
    followMarkerId: data.followMarkerId ?? null,
    fitAll: data.fitAll ?? false,
  });
}

export function buildOsmMapHtml(options: BuildOsmMapHtmlOptions): string {
  const {
    center,
    zoom = 15,
    markers = [],
    polylines = [],
    interactive = false,
    pinCoordinate = null,
    followMarkerId = null,
  } = options;

  const shell = JSON.stringify({ center, zoom, interactive, pinCoordinate });
  const initial = buildOsmMapLivePayload({ markers, polylines, followMarkerId, fitAll: true });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    html, body, #map { margin: 0; height: 100%; width: 100%; background: #e8eef5; }
    .leaflet-control-attribution { font-size: 9px; }
    .zin-pin-wrap { background: transparent; border: none; }
    .zin-pin {
      position: relative;
      width: var(--pin-size, 40px);
      height: calc(var(--pin-size, 40px) + 10px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.28));
    }
    .zin-pin-bubble {
      width: var(--pin-size, 40px);
      height: var(--pin-size, 40px);
      border-radius: 999px;
      background: var(--pin-color, #1A56DB);
      border: 2.5px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: calc(var(--pin-size, 40px) * 0.42);
      line-height: 1;
    }
    .zin-pin-tail {
      width: 12px;
      height: 12px;
      margin-top: -6px;
      background: var(--pin-color, #1A56DB);
      border: 2px solid #fff;
      transform: rotate(45deg);
    }
    .zin-pin.zin-pulse .zin-pin-bubble {
      animation: zin-pulse 1.6s ease-out infinite;
    }
    @keyframes zin-pulse {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.55); }
      70% { box-shadow: 0 0 0 14px rgba(59, 130, 246, 0); }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var shell = ${shell};
    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView(
      [shell.center.latitude, shell.center.longitude],
      shell.zoom
    );
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    function postMessage(payload) {
      var json = JSON.stringify(payload);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(json);
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(json, '*');
      }
    }

    function postMove(lat, lng) {
      postMessage({ type: 'move', latitude: lat, longitude: lng });
    }

    var pinMarker = null;
    var markerLayers = {};
    var polylineLayers = [];
    var hasInitialFit = false;
    var lastFollowId = null;
    var followPaused = false;

    map.on('dragstart', function() { followPaused = true; });
    map.on('zoomstart', function(e) {
      if (e.originalEvent) followPaused = true;
    });

    if (shell.pinCoordinate) {
      pinMarker = L.marker([shell.pinCoordinate.latitude, shell.pinCoordinate.longitude], {
        draggable: shell.interactive
      }).addTo(map);
      if (shell.interactive) {
        pinMarker.on('dragend', function(e) {
          var p = e.target.getLatLng();
          postMove(p.lat, p.lng);
        });
      }
    }

    function clearDynamicLayers() {
      Object.keys(markerLayers).forEach(function(id) {
        map.removeLayer(markerLayers[id]);
        delete markerLayers[id];
      });
      polylineLayers.forEach(function(layer) { map.removeLayer(layer); });
      polylineLayers = [];
    }

    function pinStyleFor(m) {
      if (m.pinType === 'driver' || m.id === 'driver') {
        return { emoji: '🛵', color: m.color || '#3B82F6', size: 46 };
      }
      if (m.pinType === 'restaurant' || m.id === 'restaurant') {
        return { emoji: '🍽️', color: m.color || '#1A56DB', size: 38 };
      }
      if (m.pinType === 'pickup' || m.id === 'pickup') {
        return { emoji: '📦', color: m.color || '#C2410C', size: 38 };
      }
      if (m.pinType === 'delivery' || m.id === 'delivery') {
        return { emoji: '📍', color: m.color || '#22C55E', size: 38 };
      }
      if (m.pinType === 'me' || m.id === 'me') {
        return { emoji: '📍', color: m.color || '#2563EB', size: 40 };
      }
      return { emoji: '●', color: m.color || '#1A56DB', size: 32 };
    }

    function createPinIcon(m) {
      var style = pinStyleFor(m);
      var pulseClass = m.pulse ? ' zin-pulse' : '';
      var html =
        '<div class="zin-pin' + pulseClass + '" style="--pin-color:' + style.color + ';--pin-size:' + style.size + 'px">' +
        '<div class="zin-pin-bubble">' + style.emoji + '</div>' +
        '<div class="zin-pin-tail"></div></div>';
      return L.divIcon({
        className: 'zin-pin-wrap',
        html: html,
        iconSize: [style.size, style.size + 10],
        iconAnchor: [style.size / 2, style.size + 8],
      });
    }

    window.setMapData = function(raw) {
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      clearDynamicLayers();

      (data.markers || []).forEach(function(m) {
        if (!m || !m.id || !m.coordinate) return;
        if (shell.pinCoordinate && m.id === 'pin') return;
        var layer = L.marker(
          [m.coordinate.latitude, m.coordinate.longitude],
          { icon: createPinIcon(m), zIndexOffset: m.id === 'driver' || m.id === 'me' ? 500 : 100 }
        ).addTo(map);
        if (m.label) layer.bindPopup(m.label);
        layer.on('click', function() {
          postMessage({ type: 'markerPress', id: m.id });
        });
        markerLayers[m.id] = layer;
      });

      (data.polylines || []).forEach(function(line) {
        if (!line.coordinates || line.coordinates.length < 2) return;
        var layer = L.polyline(
          line.coordinates.map(function(c) { return [c.latitude, c.longitude]; }),
          { color: line.color || '#1A56DB', weight: 4, opacity: 0.85 }
        ).addTo(map);
        polylineLayers.push(layer);
      });

      var followId = data.followMarkerId || null;
      if (followId && markerLayers[followId] && !followPaused) {
        var ll = markerLayers[followId].getLatLng();
        if (!hasInitialFit || followId !== lastFollowId) {
          map.setView(ll, Math.max(map.getZoom(), 15));
          hasInitialFit = true;
        } else {
          map.panTo(ll, { animate: true, duration: 0.45 });
        }
        lastFollowId = followId;
        return;
      }

      if (followId && markerLayers[followId]) {
        lastFollowId = followId;
        return;
      }

      if (data.fitAll) {
        var allCoords = [];
        (data.markers || []).forEach(function(m) {
          if (m && m.coordinate) allCoords.push([m.coordinate.latitude, m.coordinate.longitude]);
        });
        (data.polylines || []).forEach(function(line) {
          (line.coordinates || []).forEach(function(c) {
            allCoords.push([c.latitude, c.longitude]);
          });
        });
        if (shell.pinCoordinate) {
          allCoords.push([shell.pinCoordinate.latitude, shell.pinCoordinate.longitude]);
        }
        if (allCoords.length > 1) {
          map.fitBounds(allCoords, { padding: [28, 28] });
          hasInitialFit = true;
        } else if (allCoords.length === 1) {
          map.setView(allCoords[0], shell.zoom);
          hasInitialFit = true;
        }
        lastFollowId = null;
      }
    };

    if (shell.interactive) {
      map.on('click', function(e) {
        if (pinMarker) {
          pinMarker.setLatLng(e.latlng);
        } else {
          pinMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
          pinMarker.on('dragend', function(ev) {
            var p = ev.target.getLatLng();
            postMove(p.lat, p.lng);
          });
        }
        postMove(e.latlng.lat, e.latlng.lng);
      });
    }

    window.setPinPosition = function(lat, lng) {
      if (!shell.interactive) return;
      if (pinMarker) {
        pinMarker.setLatLng([lat, lng]);
      } else {
        pinMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
        pinMarker.on('dragend', function(ev) {
          var p = ev.target.getLatLng();
          postMove(p.lat, p.lng);
        });
      }
      map.panTo([lat, lng]);
    };

    window.addEventListener('message', function(event) {
      var data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return; }
      }
      if (!data || !data.type) return;
      if (data.type === 'setMapData' && data.payload) {
        var payload = typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload);
        if (window.setMapData) window.setMapData(payload);
      }
      if (data.type === 'setPinPosition') {
        if (window.setPinPosition) window.setPinPosition(data.latitude, data.longitude);
      }
    });

    window.setMapData(${initial});
    postMessage({ type: 'ready' });
  <\/script>
</body>
</html>`;
}

import type { MapCoordinate } from './maps';

export interface OsmMapMarker {
  id: string;
  coordinate: MapCoordinate;
  color?: string;
  label?: string;
}

export interface OsmMapPolyline {
  coordinates: MapCoordinate[];
  color?: string;
}

interface BuildOsmMapHtmlOptions {
  center: MapCoordinate;
  zoom?: number;
  markers?: OsmMapMarker[];
  polylines?: OsmMapPolyline[];
  interactive?: boolean;
  pinCoordinate?: MapCoordinate | null;
}

export function buildOsmMapHtml(options: BuildOsmMapHtmlOptions): string {
  const {
    center,
    zoom = 15,
    markers = [],
    polylines = [],
    interactive = false,
    pinCoordinate = null,
  } = options;

  const payload = JSON.stringify({
    center,
    zoom,
    markers,
    polylines,
    interactive,
    pinCoordinate,
  });

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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var config = ${payload};
    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView(
      [config.center.latitude, config.center.longitude],
      config.zoom
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    function postMessage(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function postMove(lat, lng) {
      postMessage({ type: 'move', latitude: lat, longitude: lng });
    }

    var pinMarker = null;
    if (config.pinCoordinate) {
      pinMarker = L.marker([config.pinCoordinate.latitude, config.pinCoordinate.longitude], {
        draggable: config.interactive
      }).addTo(map);
      if (config.interactive) {
        pinMarker.on('dragend', function(e) {
          var p = e.target.getLatLng();
          postMove(p.lat, p.lng);
        });
      }
    }

    (config.markers || []).forEach(function(m) {
      if (config.pinCoordinate && m.id === 'pin') return;
      var marker = L.circleMarker([m.coordinate.latitude, m.coordinate.longitude], {
        radius: 8,
        color: m.color || '#1A56DB',
        fillColor: m.color || '#1A56DB',
        fillOpacity: 0.9,
        weight: 2
      }).addTo(map);
      if (m.label) marker.bindPopup(m.label);
      if (m.id) {
        marker.on('click', function() {
          postMessage({ type: 'markerPress', id: m.id });
        });
      }
    });

    (config.polylines || []).forEach(function(line) {
      if (!line.coordinates || line.coordinates.length < 2) return;
      L.polyline(
        line.coordinates.map(function(c) { return [c.latitude, c.longitude]; }),
        { color: line.color || '#1A56DB', weight: 4, opacity: 0.85 }
      ).addTo(map);
    });

    var allCoords = [];
    (config.markers || []).forEach(function(m) {
      allCoords.push([m.coordinate.latitude, m.coordinate.longitude]);
    });
    (config.polylines || []).forEach(function(line) {
      (line.coordinates || []).forEach(function(c) {
        allCoords.push([c.latitude, c.longitude]);
      });
    });
    if (config.pinCoordinate) {
      allCoords.push([config.pinCoordinate.latitude, config.pinCoordinate.longitude]);
    }
    if (allCoords.length > 1) {
      map.fitBounds(allCoords, { padding: [28, 28] });
    }

    if (config.interactive) {
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
      if (!config.interactive) return;
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
  <\/script>
</body>
</html>`;
}

import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Navigation, LocateFixed, Loader2 } from 'lucide-react'
import { useGeolocation } from '../hooks/useGeolocation'

const RADIUS_M = 3000

const KINDS = {
  hospital: { label: 'بیمارستان', color: '#dc2626' },
  clinic: { label: 'درمانگاه', color: '#dc2626' },
  police: { label: 'پلیس', color: '#1d4ed8' },
  fire_station: { label: 'آتش‌نشانی', color: '#ea580c' },
}

function pinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
  })
}

function haversine(a, b) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function fetchCenters({ lat, lng }) {
  const q = `[out:json][timeout:25];(
    node["amenity"="hospital"](around:${RADIUS_M},${lat},${lng});
    node["amenity"="clinic"](around:${RADIUS_M},${lat},${lng});
    node["amenity"="police"](around:${RADIUS_M},${lat},${lng});
    node["amenity"="fire_station"](around:${RADIUS_M},${lat},${lng});
  );out body 60;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(q),
  })
  if (!res.ok) throw new Error('overpass')
  const json = await res.json()
  return (json.elements || [])
    .filter((e) => e.lat && e.lon && KINDS[e.tags?.amenity])
    .map((e) => ({
      id: e.id,
      lat: e.lat,
      lng: e.lon,
      amenity: e.tags.amenity,
      name: e.tags.name || KINDS[e.tags.amenity].label,
      distance: haversine({ lat, lng }, { lat: e.lat, lng: e.lon }),
    }))
    .sort((a, b) => a.distance - b.distance)
}

export function EmergencyCenters() {
  const geo = useGeolocation()
  const [centers, setCenters] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function locateAndLoad() {
    setError('')
    setLoading(true)
    try {
      const loc = await geo.request()
      const found = await fetchCenters(loc)
      setCenters(found)
    } catch {
      setError(
        geo.error ||
          'دریافت مراکز نزدیک ناموفق بود. اتصال اینترنت را بررسی کنید.',
      )
    } finally {
      setLoading(false)
    }
  }

  const me = geo.coords

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-bold text-ink-900 dark:text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral-500/15 text-coral-500">
            <Navigation className="h-5 w-5" />
          </span>
          مراکز حیاتی نزدیک شما
        </p>
        <button
          type="button"
          onClick={locateAndLoad}
          disabled={loading}
          className="btn-coral btn-sm"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {loading ? 'در حال یافتن…' : 'یافتن نزدیک‌ترین مراکز'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-coral-400/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-600 dark:text-coral-300">
          {error}
        </div>
      )}

      {me && centers && (
        <>
          <div className="mt-3 h-64 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            <MapContainer
              key={`${me.lat},${me.lng}`}
              center={[me.lat, me.lng]}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Circle
                center={[me.lat, me.lng]}
                radius={RADIUS_M}
                pathOptions={{ color: '#0ea5e9', fillOpacity: 0.05 }}
              />
              {centers.map((c) => (
                <Marker key={c.id} position={[c.lat, c.lng]} icon={pinIcon(KINDS[c.amenity].color)}>
                  <Popup>
                    <strong>{c.name}</strong>
                    <br />
                    {KINDS[c.amenity].label} · {(c.distance / 1000).toFixed(1)} کیلومتر
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {centers.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              مرکزی در شعاع ۳ کیلومتری یافت نشد.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {centers.slice(0, 5).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <span className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: KINDS[c.amenity].color }}
                    />
                    {c.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {(c.distance / 1000).toFixed(1)} کیلومتر
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

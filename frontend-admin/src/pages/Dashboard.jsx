import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { api, flattenFeatures, logoutClient } from '../api/client'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

const STATUSES = [
  ['SUBMITTED', 'ثبت شده'],
  ['UNDER_REVIEW', 'در حال بررسی'],
  ['ASSIGNED', 'ارجاع داده‌شده'],
  ['IN_PROGRESS', 'در حال اقدام'],
  ['RESOLVED', 'حل‌شده'],
  ['CLOSED', 'مختومه'],
]

function MapFocus({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, 14)
  }, [center, map])
  return null
}

function SpatialSelector({ onPointSelected, active }) {
  useMapEvents({
    click(e) {
      if (active) onPointSelected(e.latlng)
    },
  })
  return null
}

export default function Dashboard() {
  const [features, setFeatures] = useState([])
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [nextStatus, setNextStatus] = useState('UNDER_REVIEW')
  const [afterFile, setAfterFile] = useState(null)
  const [busy, setBusy] = useState(false)

  // Spatial Search States
  const [spatialMode, setSpatialMode] = useState(false)
  const [spatialPoint, setSpatialPoint] = useState(null)
  const [radiusKm, setRadiusKm] = useState(5)

  async function load(params = {}) {
    try {
      const res = await api.get('reports/', { params })
      setFeatures(flattenFeatures(res.data))
      setError('')
    } catch {
      setError('بارگذاری گزارش‌ها ناموفق بود (احتمالاً نیاز به حساب مدیر).')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSpatialSearch = () => {
    if (!spatialPoint) {
      setError('ابتدا نقطه‌ای را روی نقشه انتخاب کنید.')
      return
    }
    // DRF GIS DistanceToPointFilter expects dist and point (lon,lat)
    load({
      dist: radiusKm * 1000,
      point: `${spatialPoint.lng},${spatialPoint.lat}`
    })
  }

  const filtered = useMemo(() => {
    return features.filter((f) => {
      const p = f.properties || {}
      if (statusFilter && p.status !== statusFilter) return false
      if (urgentOnly && !p.is_urgent) return false
      if (search && !(p.description || '').includes(search)) return false
      return true
    })
  }, [features, statusFilter, urgentOnly, search])

  const selected = filtered.find((f) => String(f.id) === String(selectedId))

  const center = useMemo(() => {
    if (spatialPoint) return [spatialPoint.lat, spatialPoint.lng]
    const active = selected || filtered[0]
    if (!active?.geometry?.coordinates) return [35.6892, 51.389]
    const [lng, lat] = active.geometry.coordinates
    return [lat, lng]
  }, [filtered, selected, spatialPoint])

  async function submitTransition(e) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    const fd = new FormData()
    fd.append('status', nextStatus)
    if (afterFile) fd.append('image_after', afterFile)
    try {
      await api.post(`reports/${selected.id}/transition/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await load()
      setAfterFile(null)
    } catch (err) {
      console.error(err)
      setError('به‌روزرسانی وضعیت ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full border-b border-white/10 bg-slate-900/60 p-4 lg:w-96 lg:border-b-0 lg:border-l">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">UrbanHelper</p>
            <h1 className="text-xl font-bold text-white">داشبورد مدیریت</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              logoutClient()
              window.location.href = '/login'
            }}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
          >
            خروج
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}
        
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider">تحلیل فضایی (GIS)</h3>
            <div className="mt-2 space-y-2">
              <button
                onClick={() => setSpatialMode(!spatialMode)}
                className={`w-full rounded-xl py-2 text-xs font-semibold transition ${spatialMode ? 'bg-sky-500 text-slate-950' : 'bg-white/5 text-sky-400 border border-sky-500/20'}`}
              >
                {spatialMode ? 'انتخاب نقطه فعال است' : 'جستجوی شعاعی'}
              </button>
              {spatialMode && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] text-slate-400">روی نقشه کلیک کنید تا مرکز جستجو مشخص شود.</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={radiusKm} 
                      onChange={(e) => setRadiusKm(e.target.value)}
                      className="w-full rounded-lg bg-slate-950 border border-white/10 px-2 py-1 text-xs text-white"
                      placeholder="شعاع (کیلومتر)"
                    />
                    <button 
                      onClick={handleSpatialSearch}
                      className="rounded-lg bg-sky-600 px-3 py-1 text-xs text-white hover:bg-sky-700"
                    >
                      اعمال
                    </button>
                    <button 
                      onClick={() => { setSpatialPoint(null); setSpatialMode(false); load(); }}
                      className="text-xs text-slate-500 hover:text-white"
                    >
                      لغو
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در متن گزارش..."
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-sky-400 focus:ring-2"
            />
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="">همه وضعیت‌ها</option>
                {STATUSES.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={urgentOnly}
                  onChange={(e) => setUrgentOnly(e.target.checked)}
                />
                فوری
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 max-h-[30vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[50vh]">
          {filtered.map((f) => (
            <button
              type="button"
              key={f.id}
              onClick={() => {
                setSelectedId(f.id)
                setNextStatus(f.properties?.status || 'UNDER_REVIEW')
              }}
              className={`w-full rounded-2xl border px-3 py-3 text-right text-sm transition ${
                String(selectedId) === String(f.id)
                  ? 'border-sky-400/70 bg-sky-500/10'
                  : 'border-white/5 bg-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">#{f.id}</span>
                <span className="text-xs text-amber-200">
                  {f.properties?.is_urgent ? 'فوری' : 'عادی'}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-slate-300">
                {f.properties?.description}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{f.properties?.status}</p>
            </button>
          ))}
        </div>
        {selected && (
          <form className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4" onSubmit={submitTransition}>
            <div className="text-sm font-semibold text-white">تغییر وضعیت #{selected.id}</div>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {STATUSES.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div>
              <label className="text-xs text-slate-400">تصویر بعد (برای حل‌شده)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAfterFile(e.target.files?.[0] || null)}
                className="mt-2 w-full text-xs text-slate-200 file:mr-2 file:rounded-lg file:border-0 file:bg-sky-500 file:px-3 file:py-2 file:text-slate-950"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-500 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {busy ? 'در حال ذخیره…' : 'ثبت انتقال وضعیت'}
            </button>
          </form>
        )}
        <Link className="mt-4 block text-center text-xs text-slate-500" to="/login">
          بازگشت به ورود
        </Link>
      </aside>
      <main className="relative min-h-[50vh] flex-1">
        <MapContainer center={center} zoom={12} className="h-full min-h-[50vh] w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapFocus center={center} />
          <SpatialSelector active={spatialMode} onPointSelected={setSpatialPoint} />
          {spatialPoint && (
            <Marker position={[spatialPoint.lat, spatialPoint.lng]}>
              <Popup>مرکز جستجو</Popup>
            </Marker>
          )}
          {filtered.map((f) => {
            const coords = f.geometry?.coordinates
            if (!coords) return null
            const [lng, lat] = coords
            return (
              <Marker
                key={f.id}
                position={[lat, lng]}
                eventHandlers={{
                  click: () => {
                    setSelectedId(f.id)
                    setNextStatus(f.properties?.status || 'UNDER_REVIEW')
                  },
                }}
              >
                <Popup>
                  <div className="text-slate-900" dir="rtl">
                    <div className="font-bold">#{f.id}</div>
                    <div className="text-xs">{f.properties?.status}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </main>
    </div>
  )
}

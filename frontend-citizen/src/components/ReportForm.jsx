import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { api } from '../api/client'
import { getPendingReports, saveReportOffline, syncReports } from '../api/offline'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng)
    },
  })
  return position ? <Marker position={position} /> : null
}

export function ReportForm({ onSubmitted }) {
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    api
      .get('categories/')
      .then((res) => setCategories(res.data))
      .catch(() => setMsg('بارگذاری دسته‌بندی‌ها ناموفق بود.'))
    
    setPendingCount(getPendingReports().length)
  }, [])

  async function handleSync() {
    setBusy(true)
    setMsg('در حال همگام‌سازی گزارش‌های آفلاین...')
    const res = await syncReports()
    setPendingCount(getPendingReports().length)
    setMsg(`همگام‌سازی انجام شد: ${res.synced} موفق، ${res.failed} ناموفق.`)
    setBusy(false)
  }

  async function submit(e) {
    e.preventDefault()
    if (!description.trim() || !position || !file) {
      setMsg('تمام فیلدها را تکمیل کنید و موقعیت را روی نقشه مشخص کنید.')
      return
    }
    setBusy(true)
    setMsg('')
    
    const reportData = {
      category,
      description,
      location: `POINT(${position.lng} ${position.lat})`
    }

    const fd = new FormData()
    if (category) fd.append('category', category)
    fd.append('description', description)
    fd.append('image_before', file)
    fd.append('location', reportData.location)

    try {
      const res = await api.post('reports/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const token = res.data?.properties?.guest_access_token || res.data?.guest_access_token
      const id = res.data?.id || res.data?.properties?.id
      if (onSubmitted) onSubmitted({ id, guestToken: token })
      setMsg('گزارش با موفقیت ثبت شد.')
      setCategory('')
      setDescription('')
      setPosition(null)
      setFile(null)
    } catch (err) {
      console.error(err)
      setMsg('ارسال گزارش با خطا مواجه شد. آیا می‌خواهید گزارش را برای ارسال خودکار در زمان اتصال ذخیره کنید؟')
      // Show offline save option
    } finally {
      setBusy(false)
    }
  }

  async function saveOffline() {
    setBusy(true)
    try {
      await saveReportOffline({
        category,
        description,
        location: `POINT(${position.lng} ${position.lat})`
      }, file)
      setMsg('گزارش با موفقیت به صورت آفلاین ذخیره شد. در زمان اتصال به اینترنت آن را همگام‌سازی کنید.')
      setPendingCount(getPendingReports().length)
      setCategory('')
      setDescription('')
      setPosition(null)
      setFile(null)
    } catch (err) {
      setMsg('خطا در ذخیره‌سازی آفلاین.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-brand-50 p-4 border border-brand-200">
          <span className="text-sm font-medium text-brand-900">شما {pendingCount} گزارش آماده همگام‌سازی دارید.</span>
          <button 
            onClick={handleSync}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            همگام‌سازی اکنون
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">نوع مشکل</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner outline-none ring-brand-600 focus:ring-2"
          >
            <option value="">(اختیاری — دسته پیشنهادی توسط هوش مصنوعی)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">توضیحات</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner outline-none ring-brand-600 focus:ring-2"
            placeholder="شرح دقیق مشکل را بنویسید..."
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            موقعیت روی نقشه
          </label>
          <div className="h-72 overflow-hidden rounded-2xl border border-slate-200 shadow-inner">
            <MapContainer
              center={[35.6892, 51.389]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationMarker position={position} setPosition={setPosition} />
            </MapContainer>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">تصویر (الزامی: فقط دوربین)</label>
          <p className="mb-2 text-xs text-rose-600 font-medium">
            توجه: برای تایید اعتبار گزارش، تصویر باید مستقیماً با دوربین ثبت شود. آپلود از گالری باعث رد گزارش خواهد شد.
          </p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-700"
          />
        </div>
        {msg && (
          <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800">
            {msg}
            {msg.includes('خطا') && !msg.includes('آفلاین') && (
              <button 
                type="button"
                onClick={saveOffline}
                className="mt-2 block font-bold text-brand-700 underline"
              >
                ذخیره آفلاین گزارش
              </button>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-brand-700 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-brand-900 disabled:opacity-60"
        >
          {busy ? 'در حال ارسال…' : 'ثبت گزارش'}
        </button>
      </form>
    </div>
  )
}

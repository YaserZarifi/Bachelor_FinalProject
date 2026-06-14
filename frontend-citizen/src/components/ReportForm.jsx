import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { AnimatePresence, motion } from 'framer-motion'
import { CloudUpload, Lock, Send, Tag, FileText, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import {
  buildReportFormData,
  countPendingReports,
  saveReportOffline,
  syncReports,
} from '../api/offline'
import { CameraCapture } from './CameraCapture'

const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] })
L.Marker.prototype.options.icon = DefaultIcon

export function ReportForm({ onSubmitted }) {
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [capture, setCapture] = useState(null) // package from <CameraCapture/>
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [canSaveOffline, setCanSaveOffline] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  async function refreshPending() {
    setPendingCount(await countPendingReports())
  }

  useEffect(() => {
    api
      .get('categories/')
      .then((res) => setCategories(res.data))
      .catch(() => setMsg('بارگذاری دسته‌بندی‌ها ناموفق بود.'))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPending()
  }, [])

  // Offline-First: when the network returns, flush the queue automatically.
  useEffect(() => {
    async function onOnline() {
      const res = await syncReports()
      await refreshPending()
      if (res.synced) setMsg(`${res.synced} گزارش آفلاین به‌صورت خودکار همگام‌سازی شد.`)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  async function handleSync() {
    setBusy(true)
    setMsg('در حال همگام‌سازی گزارش‌های آفلاین…')
    const res = await syncReports()
    await refreshPending()
    setMsg(`همگام‌سازی انجام شد: ${res.synced} موفق، ${res.failed} ناموفق.`)
    setBusy(false)
  }

  function resetForm() {
    setCategory('')
    setDescription('')
    if (capture?.previewUrl) URL.revokeObjectURL(capture.previewUrl)
    setCapture(null)
    setCanSaveOffline(false)
  }

  async function submit(e) {
    e.preventDefault()
    setCanSaveOffline(false)
    if (!description.trim()) {
      setMsg('لطفاً توضیحات مشکل را بنویسید.')
      return
    }
    if (!capture) {
      setMsg('برای ثبت گزارش، ابتدا تصویر را با دوربین ثبت کنید.')
      return
    }
    setBusy(true)
    setMsg('')

    try {
      const fd = buildReportFormData({ category, description, ...capture })
      const res = await api.post('reports/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const token =
        res.data?.properties?.guest_access_token || res.data?.guest_access_token
      const id = res.data?.id || res.data?.properties?.id
      if (onSubmitted) onSubmitted({ id, guestToken: token })
      setMsg('گزارش با موفقیت ثبت شد.')
      resetForm()
    } catch (err) {
      console.error(err)
      setMsg('ارسال گزارش ناموفق بود. می‌توانید آن را برای ارسال خودکار هنگام اتصال ذخیره کنید.')
      setCanSaveOffline(true)
    } finally {
      setBusy(false)
    }
  }

  async function saveOffline() {
    setBusy(true)
    try {
      await saveReportOffline({ category, description, capture })
      setMsg('گزارش به‌صورت آفلاین ذخیره شد و هنگام اتصال به اینترنت خودکار ارسال می‌شود.')
      await refreshPending()
      resetForm()
    } catch {
      setMsg('خطا در ذخیره‌سازی آفلاین.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-between gap-3 rounded-2xl border border-brand-400/30 bg-brand-500/10 p-4"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-200">
              <CloudUpload className="h-5 w-5" />
              شما {pendingCount.toLocaleString('fa-IR')} گزارش آمادهٔ همگام‌سازی دارید.
            </span>
            <button
              onClick={handleSync}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              همگام‌سازی اکنون
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label inline-flex items-center gap-1.5">
            <Tag className="h-4 w-4 text-brand-500" />
            نوع مشکل
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input"
          >
            <option value="">(اختیاری — دستهٔ پیشنهادی توسط هوش مصنوعی)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label inline-flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-brand-500" />
            توضیحات
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="input resize-none"
            placeholder="شرح دقیق مشکل را بنویسید…"
          />
        </div>

        <div>
          <label className="label">تصویر و موقعیت (با دوربین)</label>
          <CameraCapture
            captured={capture}
            onCapture={setCapture}
            onClear={() => setCapture(null)}
          />
        </div>

        <AnimatePresence>
          {capture && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <label className="label inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-500" />
                موقعیت ثبت‌شده (قفل‌شده روی محل دوربین)
              </label>
              <div className="h-56 overflow-hidden rounded-3xl border border-white/50 shadow-inner dark:border-white/10">
                <MapContainer
                  key={`${capture.lat},${capture.lng}`}
                  center={[capture.lat, capture.lng]}
                  zoom={16}
                  scrollWheelZoom={false}
                  dragging={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[capture.lat, capture.lng]} />
                </MapContainer>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                این موقعیت از GPS دستگاه شما خوانده شده و قابل تغییر دستی نیست.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {msg}
              {canSaveOffline && capture && (
                <button
                  type="button"
                  onClick={saveOffline}
                  className="mt-2 inline-flex items-center gap-1.5 font-bold text-brand-600 underline dark:text-brand-300"
                >
                  <CloudUpload className="h-4 w-4" />
                  ذخیرهٔ آفلاین گزارش
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={busy} className="btn-primary w-full py-4 text-lg">
          <Send className="h-5 w-5" />
          {busy ? 'در حال ارسال…' : 'ثبت گزارش'}
        </button>
      </form>
    </div>
  )
}

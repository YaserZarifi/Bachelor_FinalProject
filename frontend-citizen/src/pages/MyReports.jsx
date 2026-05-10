import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, flattenFeatures, wsBaseUrl } from '../api/client'

export function MyReports() {
  const [items, setItems] = useState([])
  const [toast, setToast] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api
      .get('reports/')
      .then((res) => setItems(flattenFeatures(res.data)))
      .catch(() => setToast('برای مشاهده گزارش‌ها وارد شوید.'))
  }, [])

  const detail = useMemo(
    () => items.find((f) => String(f.id) === String(selected)),
    [items, selected],
  )

  useEffect(() => {
    if (!detail?.id) return undefined
    const token = localStorage.getItem('access_token')
    const qs = new URLSearchParams()
    if (token) qs.set('access', token)
    const url = `${wsBaseUrl()}/ws/reports/${detail.id}/?${qs.toString()}`
    const ws = new WebSocket(url)
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.status) {
          setToast(`وضعیت به‌روز شد: ${data.status}`)
          api.get('reports/').then((res) => setItems(flattenFeatures(res.data)))
        }
      } catch {
        /* ignore */
      }
    }
    return () => ws.close()
  }, [detail?.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">گزارش‌های من</h2>
        <Link className="text-sm font-semibold text-brand-700" to="/">
          بازگشت
        </Link>
      </div>
      {toast && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow">
          {toast}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          {items.length === 0 && (
            <p className="text-sm text-slate-600">گزارشی یافت نشد یا نیاز به ورود دارید.</p>
          )}
          {items.map((f) => (
            <button
              type="button"
              key={f.id}
              onClick={() => setSelected(f.id)}
              className={`w-full rounded-xl border px-4 py-3 text-right transition ${
                selected === f.id
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-100 hover:border-brand-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">#{f.id}</span>
                <span className="text-xs text-slate-500">{f.properties?.status}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                {f.properties?.description}
              </p>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          {detail ? (
            <div className="space-y-3 text-sm text-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">شناسه</span>
                <span className="font-semibold">#{detail.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">وضعیت</span>
                <span>{detail.properties?.status}</span>
              </div>
              <div>
                <p className="text-xs text-slate-500">توضیحات</p>
                <p className="mt-1 leading-relaxed">{detail.properties?.description}</p>
              </div>
              <p className="text-xs text-slate-500">
                برای اتصال زنده، یک گزارش را انتخاب کنید؛ پیام‌های وضعیت اینجا نمایش داده
                می‌شوند.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">یک گزارش را انتخاب کنید.</p>
          )}
        </div>
      </div>
    </div>
  )
}

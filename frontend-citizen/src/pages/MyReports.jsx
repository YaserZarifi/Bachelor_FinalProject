import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Inbox,
  Radio,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Tag,
  CalendarDays,
  ImageOff,
} from 'lucide-react'
import { api, flattenFeatures, wsBaseUrl, mediaUrl } from '../api/client'

const STATUS_FLOW = [
  ['SUBMITTED', 'ثبت شده'],
  ['UNDER_REVIEW', 'در حال بررسی'],
  ['ASSIGNED', 'ارجاع داده‌شده'],
  ['IN_PROGRESS', 'در حال اقدام'],
  ['RESOLVED', 'حل‌شده'],
  ['CLOSED', 'مختومه'],
]
const STATUS_LABEL = Object.fromEntries(STATUS_FLOW)

function statusTone(status) {
  switch (status) {
    case 'RESOLVED':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
    case 'CLOSED':
      return 'bg-slate-500/15 text-slate-500 dark:text-slate-300'
    case 'IN_PROGRESS':
      return 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
    case 'UNDER_REVIEW':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
    case 'ASSIGNED':
      return 'bg-aurora-violet/15 text-violet-600 dark:text-violet-300'
    default:
      return 'bg-aurora-cyan/15 text-cyan-600 dark:text-cyan-300'
  }
}

function Photo({ src, label, tone }) {
  if (!src) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-slate-400 dark:border-white/10 dark:text-slate-500">
        <ImageOff className="h-7 w-7" />
        <span className="text-xs">بدون تصویر</span>
      </div>
    )
  }
  return (
    <a
      href={mediaUrl(src)}
      target="_blank"
      rel="noreferrer"
      className="group relative block h-40 overflow-hidden rounded-2xl border border-white/50 dark:border-white/10"
    >
      <img
        src={mediaUrl(src)}
        alt={label}
        className="h-full w-full object-cover transition group-hover:scale-105"
      />
      <span
        className={`absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-xs font-bold text-white ${tone}`}
      >
        {label}
      </span>
    </a>
  )
}

function Timeline({ status }) {
  const activeIdx = STATUS_FLOW.findIndex(([k]) => k === status)
  return (
    <ol className="mt-4 space-y-0">
      {STATUS_FLOW.map(([key, label], i) => {
        const done = i < activeIdx
        const current = i === activeIdx
        return (
          <li key={key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : current
                      ? 'bg-brand-500 text-white shadow-glow'
                      : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : current ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
              </span>
              {i < STATUS_FLOW.length - 1 && (
                <span
                  className={`my-1 h-6 w-0.5 rounded-full ${
                    i < activeIdx ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
                  }`}
                />
              )}
            </div>
            <span
              className={`pt-1 text-sm font-semibold ${
                current
                  ? 'text-slate-900 dark:text-white'
                  : done
                    ? 'text-slate-600 dark:text-slate-300'
                    : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function MyReports() {
  const [items, setItems] = useState([])
  const [toast, setToast] = useState('')
  const [live, setLive] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api
      .get('reports/')
      .then((res) => setItems(flattenFeatures(res.data)))
      .catch(() => setToast('برای مشاهدهٔ گزارش‌ها وارد شوید.'))
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
    ws.onopen = () => setLive(true)
    ws.onclose = () => setLive(false)
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.status) {
          setToast(`وضعیت به‌روز شد: ${STATUS_LABEL[data.status] || data.status}`)
          api.get('reports/').then((res) => setItems(flattenFeatures(res.data)))
        }
      } catch {
        /* ignore */
      }
    }
    return () => ws.close()
  }, [detail?.id])

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-black text-slate-900 dark:text-white">
            گزارش‌های من
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            وضعیت رسیدگی را به‌صورت زنده دنبال کنید
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 dark:text-brand-300"
          to="/"
        >
          بازگشت
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
          >
            <AlertTriangle className="h-4 w-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* List */}
        <div className="space-y-3 lg:col-span-2">
          {items.length === 0 && (
            <div className="glass flex flex-col items-center gap-3 p-10 text-center">
              <Inbox className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                گزارشی یافت نشد یا نیاز به ورود دارید.
              </p>
            </div>
          )}
          {items.map((f) => {
            const isSel = selected === f.id
            return (
              <motion.button
                type="button"
                key={f.id}
                onClick={() => setSelected(f.id)}
                whileHover={{ y: -2 }}
                className={`w-full rounded-3xl border p-4 text-right transition ${
                  isSel
                    ? 'border-brand-400/60 bg-brand-500/10 shadow-glow'
                    : 'border-white/50 bg-white/60 hover:border-brand-300 dark:border-white/10 dark:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-black text-slate-900 dark:text-white">
                    #{f.id}
                  </span>
                  <span className={`chip ${statusTone(f.properties?.status)}`}>
                    {STATUS_LABEL[f.properties?.status] || f.properties?.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                  {f.properties?.description}
                </p>
              </motion.button>
            )
          })}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          <div className="glass-strong p-6">
            {detail ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-black text-slate-900 dark:text-white">
                    گزارش #{detail.id}
                  </h3>
                  <div className="flex items-center gap-2">
                    {detail.properties?.is_urgent && (
                      <span className="chip bg-rose-500/15 text-rose-600 dark:text-rose-300">
                        <AlertTriangle className="h-3.5 w-3.5" /> بحرانی
                      </span>
                    )}
                    {live && (
                      <span className="chip bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                        <Radio className="h-3.5 w-3.5 animate-pulse" /> زنده
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap gap-2">
                  <span className={`chip ${statusTone(detail.properties?.status)}`}>
                    {STATUS_LABEL[detail.properties?.status] || detail.properties?.status}
                  </span>
                  {detail.properties?.category_name && (
                    <span className="chip bg-brand-500/15 text-brand-600 dark:text-brand-300">
                      <Tag className="h-3.5 w-3.5" /> {detail.properties.category_name}
                    </span>
                  )}
                  {detail.properties?.created_at && (
                    <span className="chip bg-slate-500/15 text-slate-600 dark:text-slate-300">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(detail.properties.created_at).toLocaleDateString('fa-IR')}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">توضیحات</p>
                  <p className="mt-1.5 leading-relaxed text-slate-700 dark:text-slate-200">
                    {detail.properties?.description}
                  </p>
                </div>

                {/* Before / after photos */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    تصاویر گزارش
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <Photo
                      src={detail.properties?.image_before}
                      label="قبل"
                      tone="bg-slate-900/70"
                    />
                    {detail.properties?.image_after ? (
                      <Photo
                        src={detail.properties?.image_after}
                        label="بعد از رسیدگی"
                        tone="bg-emerald-600/80"
                      />
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-slate-400 dark:border-white/10 dark:text-slate-500">
                        <ImageOff className="h-7 w-7" />
                        <span className="text-xs">در انتظار تصویر پس از رسیدگی</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    روند رسیدگی
                  </p>
                  <Timeline status={detail.properties?.status} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Radio className="h-10 w-10 text-brand-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  یک گزارش را انتخاب کنید تا روند رسیدگی و به‌روزرسانی‌های زنده را ببینید.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

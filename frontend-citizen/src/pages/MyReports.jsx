import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Inbox,
  Radio,
  AlertTriangle,
  Tag,
  CalendarDays,
  ImageOff,
  WifiOff,
  Plus,
  LogIn,
  Sparkles,
} from 'lucide-react'
import {
  api,
  flattenFeatures,
  flattenFeature,
  fetchReport,
  mediaUrl,
  getGuestReports,
} from '../api/client'
import { statusMeta } from '../lib/status.js'
import { CivicLine } from '../components/ui/CivicLine.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { ReportCardSkeleton } from '../components/ui/Skeleton.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useReportSocket } from '../hooks/useReportSocket.js'
import { useToast } from '../components/ui/Toast.jsx'
import { useReportModal } from '../components/report/ReportModal.jsx'

function Photo({ src, label, tone, emptyLabel = 'بدون تصویر' }) {
  if (!src) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-slate-400 dark:border-white/10 dark:text-slate-500">
        <ImageOff className="h-7 w-7" />
        <span className="text-xs">{emptyLabel}</span>
      </div>
    )
  }
  return (
    <a
      href={mediaUrl(src)}
      target="_blank"
      rel="noreferrer"
      className="group relative block h-40 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10"
    >
      <img
        src={mediaUrl(src)}
        alt={label}
        className="h-full w-full object-cover transition group-hover:scale-105"
      />
      <span className={`absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-xs font-bold text-white ${tone}`}>
        {label}
      </span>
    </a>
  )
}

export function MyReports() {
  const { authed } = useAuth()
  const toast = useToast()
  const { open: openReport } = useReportModal()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  // Map of reportId → guest token, so guests can open the live socket + refetch.
  const guestTokens = useMemo(() => {
    const map = {}
    for (const g of getGuestReports()) if (g.token) map[g.id] = g.token
    return map
  }, [])

  const load = useCallback(async () => {
    setNetError(false)
    const collected = new Map()
    // Authenticated reports (own reports).
    if (authed) {
      try {
        const res = await api.get('reports/')
        for (const feat of flattenFeatures(res.data)) {
          const flat = flattenFeature(feat)
          if (flat?.id != null) collected.set(flat.id, flat)
        }
      } catch {
        setNetError(true)
      }
    }
    // Guest-tracked reports (anonymous flow) — fetch each with its token.
    const guests = getGuestReports()
    await Promise.all(
      guests.map(async (g) => {
        if (collected.has(g.id)) return
        try {
          const flat = await fetchReport(g.id, g.token)
          if (flat?.id != null) collected.set(flat.id, flat)
        } catch {
          // Keep a lightweight stub so the citizen still sees it listed.
          if (!collected.has(g.id)) {
            collected.set(g.id, {
              id: g.id,
              description: g.description || 'گزارش مهمان',
              status: 'SUBMITTED',
              _stub: true,
            })
          }
        }
      }),
    )
    const list = [...collected.values()].sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : a.id || 0
      const tb = b.created_at ? Date.parse(b.created_at) : b.id || 0
      return tb - ta
    })
    setItems(list)
    setLoading(false)
  }, [authed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    load()
  }, [load])

  const detail = useMemo(
    () => items.find((f) => String(f.id) === String(selectedId)),
    [items, selectedId],
  )

  // Refetch a single report and patch it into the list.
  const patchReport = useCallback(async (id) => {
    try {
      const flat = await fetchReport(id, guestTokens[id])
      if (flat?.id != null) {
        setItems((list) => list.map((it) => (it.id === flat.id ? flat : it)))
      }
    } catch {
      /* ignore */
    }
  }, [guestTokens])

  const detailId = detail?.id
  const onSocketEvent = useCallback(
    (data) => {
      if (data.status && detailId != null) {
        const meta = statusMeta(data.status)
        toast.push(`وضعیت گزارش #${detailId} به‌روز شد: ${meta.label}`, 'success')
        patchReport(detailId)
      }
    },
    [detailId, patchReport, toast],
  )

  const live = useReportSocket(
    detail && !detail._stub ? detail.id : null,
    detail ? guestTokens[detail.id] : null,
    onSocketEvent,
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow">پیگیری</p>
          <h1 className="mt-2 font-display text-3xl font-black text-ink-900 dark:text-white">
            گزارش‌های من
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            وضعیت رسیدگی را به‌صورت زنده دنبال کنید
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1 text-sm font-bold text-beacon-600 dark:text-beacon-300"
          to="/"
        >
          خانه
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {netError && (
        <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-coral-400/30 bg-coral-500/10 px-4 py-3 text-sm font-semibold text-coral-700 dark:text-coral-300">
          <WifiOff className="h-4 w-4" />
          دریافت گزارش‌ها ناموفق بود. اتصال اینترنت را بررسی کنید.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* List column */}
        <div className={`space-y-3 lg:col-span-2 ${selectedId ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <>
              <ReportCardSkeleton />
              <ReportCardSkeleton />
              <ReportCardSkeleton />
            </>
          ) : items.length === 0 ? (
            <div className="card">
              {authed ? (
                <EmptyState
                  icon={Inbox}
                  title="هنوز گزارشی ثبت نکرده‌اید"
                  description="اولین مشکل شهری را که می‌بینید ثبت کنید تا اینجا نمایش داده شود."
                  action={
                    <button onClick={openReport} className="btn-signal btn-sm">
                      <Plus className="h-4 w-4" /> ثبت گزارش
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={LogIn}
                  title="گزارشی برای نمایش نیست"
                  description="برای دیدن همهٔ گزارش‌ها وارد شوید، یا همین حالا به‌صورت مهمان یک گزارش ثبت کنید."
                  action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link to="/login" className="btn-primary btn-sm">
                        <LogIn className="h-4 w-4" /> ورود
                      </Link>
                      <button onClick={openReport} className="btn-signal btn-sm">
                        <Plus className="h-4 w-4" /> ثبت مهمان
                      </button>
                    </div>
                  }
                />
              )}
            </div>
          ) : (
            items.map((f) => {
              const isSel = String(selectedId) === String(f.id)
              const meta = statusMeta(f.status)
              return (
                <motion.button
                  type="button"
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  whileHover={{ y: -2 }}
                  className={`w-full rounded-2xl border p-4 text-right transition ${
                    isSel
                      ? 'border-beacon-400/60 bg-beacon-400/10 shadow-signal'
                      : 'border-slate-200/80 bg-white hover:border-beacon-300 dark:border-white/[0.08] dark:bg-ink-850 dark:hover:border-beacon-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="tnum text-lg font-black text-ink-900 dark:text-white">
                      #{f.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {f.is_urgent && (
                        <span className="chip bg-coral-100 text-coral-700 dark:bg-coral-500/15 dark:text-coral-300">
                          <AlertTriangle className="h-3 w-3" /> فوری
                        </span>
                      )}
                      <span className={`chip ${meta.chip}`}>{meta.label}</span>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                    {f.description}
                  </p>
                </motion.button>
              )
            })
          )}
        </div>

        {/* Detail column */}
        <div className={`lg:col-span-3 ${!selectedId ? 'hidden lg:block' : ''}`}>
          <div className="card-raised p-6">
            {detail ? (
              <div className="space-y-5">
                {/* mobile back-to-list */}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex items-center gap-1 text-sm font-bold text-beacon-600 lg:hidden dark:text-beacon-300"
                >
                  <ArrowRight className="h-4 w-4" />
                  فهرست گزارش‌ها
                </button>

                <div className="flex items-center justify-between">
                  <h2 className="tnum font-display text-2xl font-black text-ink-900 dark:text-white">
                    گزارش #{detail.id}
                  </h2>
                  <div className="flex items-center gap-2">
                    {detail.is_urgent && (
                      <span className="chip bg-coral-100 text-coral-700 dark:bg-coral-500/15 dark:text-coral-300">
                        <AlertTriangle className="h-3.5 w-3.5" /> فوری
                      </span>
                    )}
                    {live && (
                      <span className="chip bg-civic-100 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300">
                        <Radio className="h-3.5 w-3.5 animate-pulse" /> زنده
                      </span>
                    )}
                  </div>
                </div>

                {detail._stub && (
                  <div className="rounded-xl border border-beacon-400/30 bg-beacon-400/10 px-4 py-3 text-xs font-semibold text-beacon-800 dark:text-beacon-200">
                    اطلاعات کامل این گزارش مهمان در دسترس نیست؛ توکن پیگیری معتبر لازم است.
                  </div>
                )}

                {/* Meta chips */}
                <div className="flex flex-wrap gap-2">
                  <span className={`chip ${statusMeta(detail.status).chip}`}>
                    {statusMeta(detail.status).label}
                  </span>
                  {detail.category_name && (
                    <span className="chip bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      <Tag className="h-3.5 w-3.5" /> {detail.category_name}
                    </span>
                  )}
                  {detail.created_at && (
                    <span className="chip bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(detail.created_at).toLocaleDateString('fa-IR')}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">توضیحات</p>
                  <p className="mt-1.5 leading-relaxed text-slate-700 dark:text-slate-200">
                    {detail.description}
                  </p>
                </div>

                {/* Before / after photos */}
                {!detail._stub && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      تصاویر گزارش
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <Photo src={detail.image_before} label="قبل" tone="bg-ink-900/80" />
                      <Photo
                        src={detail.image_after}
                        label="بعد از رسیدگی"
                        tone="bg-civic-600/85"
                        emptyLabel="در انتظار تصویر پس از رسیدگی"
                      />
                    </div>
                  </div>
                )}

                {/* Lifecycle — the civic line */}
                <div>
                  <p className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    روند رسیدگی
                  </p>
                  <CivicLine status={detail.status} />
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="یک گزارش را انتخاب کنید"
                description="با انتخاب یک گزارش، روند رسیدگی و به‌روزرسانی‌های زنده را می‌بینید."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

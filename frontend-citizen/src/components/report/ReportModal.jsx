import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Camera,
  FileText,
  Tag,
  ClipboardCheck,
  Check,
  Copy,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Send,
  CloudUpload,
  RefreshCw,
  MapPin,
  Lock,
  Loader2,
} from 'lucide-react'
import { api, saveGuestReport } from '../../api/client'
import {
  buildReportFormData,
  countPendingReports,
  saveReportOffline,
  syncReports,
} from '../../api/offline'
import { CameraCapture } from '../CameraCapture'
import { BeaconPin } from '../ui/BeaconPin'

const ReportModalContext = createContext({ open: () => {}, close: () => {} })

// eslint-disable-next-line react-refresh/only-export-components
export function useReportModal() {
  return useContext(ReportModalContext)
}

const STEPS = [
  { key: 'capture', label: 'تصویر و موقعیت', icon: Camera },
  { key: 'details', label: 'جزئیات', icon: FileText },
  { key: 'review', label: 'بازبینی', icon: ClipboardCheck },
]

const panelVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.98 },
}

const slide = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
}

function Stepper({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = i < step
        const current = i === step
        return (
          <div key={s.key} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition ${
                  done
                    ? 'bg-civic-500 text-white'
                    : current
                      ? 'bg-beacon-400 text-ink-900 shadow-signal'
                      : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500'
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </span>
              <span
                className={`hidden text-sm font-semibold sm:inline ${
                  current
                    ? 'text-ink-900 dark:text-white'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`h-0.5 w-5 rounded-full transition-colors sm:w-8 ${
                  i < step ? 'bg-civic-500' : 'bg-slate-200 dark:bg-white/10'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ReportWizard({ onClose, titleId }) {
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [capture, setCapture] = useState(null)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgTone, setMsgTone] = useState('info') // info | error | success
  const [canSaveOffline, setCanSaveOffline] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [result, setResult] = useState(null) // { id, guestToken } | { offline: true }
  const [copied, setCopied] = useState(false)

  const refreshPending = useCallback(async () => {
    setPendingCount(await countPendingReports())
  }, [])

  useEffect(() => {
    api
      .get('categories/')
      .then((res) => setCategories(res.data))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPending()
  }, [refreshPending])

  useEffect(() => {
    async function onOnline() {
      const res = await syncReports()
      await refreshPending()
      if (res.synced) {
        setMsgTone('success')
        setMsg(`${res.synced.toLocaleString('fa-IR')} گزارش آفلاین به‌صورت خودکار همگام‌سازی شد.`)
      }
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refreshPending])

  const categoryName = useMemo(
    () => categories.find((c) => String(c.id) === String(category))?.name,
    [categories, category],
  )

  function go(next) {
    setDir(next > step ? 1 : -1)
    setStep(next)
    setMsg('')
  }

  async function handleSync() {
    setBusy(true)
    setMsgTone('info')
    setMsg('در حال همگام‌سازی گزارش‌های آفلاین…')
    const res = await syncReports()
    await refreshPending()
    setMsgTone(res.failed ? 'error' : 'success')
    setMsg(`همگام‌سازی: ${res.synced.toLocaleString('fa-IR')} موفق، ${res.failed.toLocaleString('fa-IR')} ناموفق.`)
    setBusy(false)
  }

  async function submit() {
    setCanSaveOffline(false)
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
      // Persist so the citizen can track this report later (guest flow).
      if (id) {
        saveGuestReport({
          id,
          token: token || null,
          description: description.slice(0, 120),
        })
      }
      setResult({ id, guestToken: token })
    } catch {
      setMsgTone('error')
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
      setResult({ offline: true })
      await refreshPending()
    } catch {
      setMsgTone('error')
      setMsg('خطا در ذخیره‌سازی آفلاین.')
    } finally {
      setBusy(false)
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(result.guestToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  function resetForNew() {
    if (capture?.previewUrl) URL.revokeObjectURL(capture.previewUrl)
    setCapture(null)
    setCategory('')
    setDescription('')
    setResult(null)
    setMsg('')
    setCanSaveOffline(false)
    go(0)
  }

  const canNext = step === 0 ? !!capture : step === 1 ? !!description.trim() : true

  // ── Success / offline-saved terminal screen ─────────────────────────────
  if (result) {
    return (
      <div className="p-6 text-center sm:p-8">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-civic-500/15 text-civic-500"
        >
          <CheckCircle2 className="h-9 w-9" />
        </motion.div>
        <h3 className="font-display text-2xl font-black text-ink-900 dark:text-white">
          {result.offline ? 'گزارش آفلاین ذخیره شد' : 'گزارش با موفقیت ثبت شد'}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {result.offline
            ? 'به‌محض اتصال به اینترنت، گزارش شما به‌صورت خودکار ارسال می‌شود.'
            : 'این گزارش به فهرست پیگیری شما افزوده شد. برای دنبال‌کردن زندهٔ وضعیت، توکن مهمان را نیز نگه دارید.'}
        </p>

        {!result.offline && result.guestToken && (
          <div className="card-inset mx-auto mt-6 max-w-sm p-4 text-right">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              توکن پیگیری مهمان:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 select-all break-all rounded-lg bg-ink-900 px-3 py-2 text-left font-mono text-xs text-civic-300">
                {result.guestToken}
              </code>
              <button
                type="button"
                onClick={copyToken}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-civic-500 text-white transition hover:bg-civic-400"
                aria-label="کپی توکن"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/reports" onClick={onClose} className="btn-primary">
            پیگیری گزارش‌ها
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <button type="button" onClick={resetForNew} className="btn-ghost">
            ثبت گزارش دیگر
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex max-h-[90vh] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
        <h3 id={titleId} className="flex items-center gap-2 font-display text-lg font-black text-ink-900 dark:text-white">
          <BeaconPin size={26} />
          ثبت گزارش شهری
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-coral-300 hover:text-coral-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Stepper */}
      <div className="px-5 py-4">
        <Stepper step={step} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        {pendingCount > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-beacon-400/30 bg-beacon-400/10 p-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-beacon-800 dark:text-beacon-200">
              <CloudUpload className="h-4 w-4" />
              {pendingCount.toLocaleString('fa-IR')} گزارش آمادهٔ همگام‌سازی
            </span>
            <button
              onClick={handleSync}
              disabled={busy}
              className="btn-primary btn-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              همگام‌سازی
            </button>
          </div>
        )}

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <div className="space-y-3 pb-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  ابتدا تصویر مشکل را با دوربین ثبت کنید؛ موقعیت دقیق همان لحظه قفل می‌شود.
                </p>
                <CameraCapture
                  captured={capture}
                  onCapture={setCapture}
                  onClear={() => setCapture(null)}
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5 pb-2">
                <div>
                  <label className="label inline-flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-beacon-500" />
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
                    <FileText className="h-4 w-4 text-beacon-500" />
                    توضیحات
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="input resize-none"
                    placeholder="شرح دقیق مشکل را بنویسید…"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    {description.trim().length.toLocaleString('fa-IR')} نویسه
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 pb-2">
                {capture && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                    <img
                      src={capture.previewUrl}
                      alt="پیش‌نمایش تصویر ثبت‌شده"
                      className="h-44 w-full object-cover"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="card-inset p-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">نوع مشکل</p>
                    <p className="mt-1 font-bold text-ink-900 dark:text-white">
                      {categoryName || 'تشخیص خودکار با هوش مصنوعی'}
                    </p>
                  </div>
                  {capture && (
                    <div className="card-inset p-3">
                      <p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <Lock className="h-3.5 w-3.5 text-civic-500" /> موقعیت قفل‌شده
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 font-bold text-ink-900 dark:text-white">
                        <MapPin className="h-4 w-4 text-beacon-500" />
                        دقت ±{Math.round(capture.accuracy).toLocaleString('fa-IR')} متر
                      </p>
                    </div>
                  )}
                </div>
                <div className="card-inset p-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">توضیحات</p>
                  <p className="mt-1 leading-relaxed text-slate-800 dark:text-slate-200">
                    {description}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {msg && (
          <div
            className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
              msgTone === 'error'
                ? 'border-coral-400/30 bg-coral-500/10 text-coral-700 dark:text-coral-300'
                : msgTone === 'success'
                  ? 'border-civic-400/30 bg-civic-500/10 text-civic-700 dark:text-civic-300'
                  : 'border-slate-200/70 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'
            }`}
          >
            {msg}
            {canSaveOffline && capture && (
              <button
                type="button"
                onClick={saveOffline}
                className="mt-2 inline-flex items-center gap-1.5 font-bold text-beacon-600 underline dark:text-beacon-300"
              >
                <CloudUpload className="h-4 w-4" />
                ذخیرهٔ آفلاین گزارش
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 px-5 py-4 dark:border-white/10">
        {step > 0 ? (
          <button type="button" onClick={() => go(step - 1)} className="btn-ghost btn-sm">
            <ArrowRight className="h-4 w-4" />
            قبلی
          </button>
        ) : (
          <span />
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={() => canNext && go(step + 1)}
            disabled={!canNext}
            className="btn-primary btn-sm"
          >
            بعدی
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={busy} className="btn-signal btn-sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? 'در حال ارسال…' : 'ثبت گزارش'}
          </button>
        )}
      </div>
    </div>
  )
}

export function ReportModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)
  const titleId = 'report-modal-title'
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen])

  // Lock background scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!isOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    // Move focus into the dialog for keyboard + screen-reader users.
    const t = setTimeout(() => panelRef.current?.focus(), 60)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [isOpen, close])

  return (
    <ReportModalContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
              onClick={close}
              aria-hidden="true"
            />
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="card-raised relative z-10 w-full max-w-lg overflow-hidden rounded-b-none rounded-t-4xl outline-none sm:rounded-4xl"
            >
              <ReportWizard onClose={close} titleId={titleId} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ReportModalContext.Provider>
  )
}

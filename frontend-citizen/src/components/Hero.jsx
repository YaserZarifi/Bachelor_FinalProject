import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, ArrowLeft, ShieldCheck, Camera, Radio } from 'lucide-react'
import { StatCounter } from './ui/StatCounter'
import { BeaconPin } from './ui/BeaconPin'
import { useReportModal } from './report/ReportModal'

const stats = [
  { value: 12000, suffix: '+', label: 'گزارش ثبت‌شده' },
  { value: 96, suffix: '٪', label: 'رضایت شهروندان' },
  { value: 8, suffix: ' دقیقه', label: 'میانگین رسیدگی' },
]

/** The signature live-signal visual: a mini city map with a pulsing beacon. */
function SignalMap() {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="card-raised relative aspect-[4/5] w-full max-w-sm overflow-hidden p-0 sm:aspect-square"
    >
      {/* map surface */}
      <div className="absolute inset-0 map-grid bg-slate-50 dark:bg-ink-900" />
      {/* faux route line */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <motion.path
          d="M8 82 Q 30 78 40 55 T 66 34 Q 74 24 92 20"
          fill="none"
          stroke="#f2a20d"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="0 0"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.5 }}
          opacity="0.7"
        />
      </svg>
      {/* small station dots */}
      <span className="absolute bottom-[16%] right-[10%] h-2.5 w-2.5 rounded-full bg-sky-500 ring-4 ring-sky-500/20" />
      <span className="absolute right-[36%] top-[42%] h-2.5 w-2.5 rounded-full bg-civic-500 ring-4 ring-civic-500/20" />
      {/* central beacon */}
      <div className="absolute left-1/2 top-[38%] -translate-x-1/2">
        <BeaconPin size={64} pulse />
      </div>
      {/* floating "received" chip */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-lift backdrop-blur dark:border-white/10 dark:bg-ink-800/95"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-civic-500/15 text-civic-500">
          <Radio size={18} />
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-sm font-black text-ink-900 dark:text-white">
            گزارش جدید دریافت شد
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            چراغ معبر خاموش · خیابان آزادی
          </p>
        </div>
        <span className="chip bg-civic-100 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300">
          زنده
        </span>
      </motion.div>
    </motion.div>
  )
}

export function Hero() {
  const { open: openReport } = useReportModal()
  return (
    <section className="relative overflow-hidden px-4 pb-8 pt-14 sm:pt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Copy column */}
        <div className="text-center lg:text-right">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-signal-ping rounded-full bg-civic-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-civic-500" />
            </span>
            سامانه فعال و در حال دریافت گزارش
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mx-auto mt-6 max-w-2xl font-display text-4xl font-black leading-[1.14] tracking-tight text-ink-900 sm:text-5xl md:text-6xl lg:mx-0 dark:text-white"
          >
            مشکلی در شهر دیدی؟{' '}
            <span className="text-signal">سیگنالش را بفرست.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl lg:mx-0 dark:text-slate-300"
          >
            چاله‌ای در خیابان، تاریکیِ معابر یا مشکلی در فضای سبز دیده‌اید؟ با یک تصویر
            معتبر و موقعیت دقیق، در کمتر از یک دقیقه گزارش دهید و روند رسیدگی را زنده
            دنبال کنید.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
          >
            <button type="button" onClick={openReport} className="btn-signal btn-lg w-full sm:w-auto">
              <Plus className="h-5 w-5" />
              ثبت گزارش جدید
            </button>
            <Link to="/reports" className="btn-ghost btn-lg w-full sm:w-auto">
              پیگیری گزارش‌های من
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500 lg:justify-start dark:text-slate-400"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-civic-500" />
              موقعیت قفل‌شده — ضدجعل
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-beacon-500" />
              فقط دوربین زنده
            </span>
          </motion.div>
        </div>

        {/* Visual column */}
        <div className="flex justify-center lg:justify-start">
          <SignalMap />
        </div>
      </div>

      {/* Stat strip */}
      <div className="mx-auto mt-14 grid max-w-4xl grid-cols-3 divide-x divide-x-reverse divide-slate-200 rounded-2xl border border-slate-200/80 bg-white/70 py-5 dark:divide-white/10 dark:border-white/[0.08] dark:bg-ink-850/70">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 + i * 0.08 }}
            className="px-2 text-center"
          >
            <div className="tnum text-2xl font-black text-ink-900 sm:text-3xl dark:text-white">
              <StatCounter value={s.value} suffix={s.suffix} />
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

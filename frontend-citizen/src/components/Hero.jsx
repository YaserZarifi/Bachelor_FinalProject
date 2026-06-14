import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Radio, MapPinned, ArrowLeft, ShieldCheck } from 'lucide-react'
import { StatCounter } from './ui/StatCounter'
import { useReportModal } from './report/ReportModal'

const features = [
  {
    icon: Sparkles,
    title: 'پردازش هوشمند',
    text: 'هوش مصنوعی (NLP) دسته‌بندی و فوریت مشکل شما را به‌صورت خودکار تشخیص می‌دهد.',
    tint: 'from-brand-500/20 to-aurora-violet/20 text-brand-500 dark:text-brand-300',
  },
  {
    icon: Radio,
    title: 'پیگیری لحظه‌ای',
    text: 'وضعیت رسیدگی به‌صورت زنده از طریق وب‌سوکت به‌روزرسانی می‌شود؛ همیشه در جریانید.',
    tint: 'from-emerald-500/20 to-aurora-teal/20 text-emerald-500 dark:text-emerald-300',
  },
  {
    icon: MapPinned,
    title: 'تحلیل مکانی',
    text: 'موقعیت دقیق شما روی نقشه‌های GIS ثبت و به شناسایی سریع بحران‌ها کمک می‌کند.',
    tint: 'from-aurora-cyan/20 to-aurora-sky/20 text-cyan-500 dark:text-cyan-300',
  },
]

const stats = [
  { value: 12000, suffix: '+', label: 'گزارش ثبت‌شده' },
  { value: 96, suffix: '٪', label: 'رضایت شهروندان' },
  { value: 24, suffix: '/۷', label: 'پایش بی‌وقفه' },
]

export function Hero() {
  const { open: openReport } = useReportModal()
  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-16 sm:pt-24">
      <div className="mx-auto max-w-6xl text-center">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          سامانه فعال و در حال دریافت گزارش
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mx-auto mt-7 max-w-4xl font-display text-5xl font-black leading-[1.12] tracking-tight text-slate-900 sm:text-6xl md:text-7xl dark:text-white"
        >
          شهرت را <span className="text-aurora">هوشمندانه</span> مدیریت کن
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl dark:text-slate-300"
        >
          چاله‌ای در خیابان، تاریکیِ معابر یا مشکلی در فضای سبز دیده‌اید؟ در کمتر از یک
          دقیقه گزارش دهید، شهرداری رسیدگی می‌کند و شما در لحظه مطلع می‌شوید.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <button type="button" onClick={openReport} className="btn-primary px-8 py-4 text-lg">
            <Sparkles className="h-5 w-5" />
            ثبت گزارش جدید
          </button>
          <Link to="/reports" className="btn-ghost px-8 py-4 text-lg">
            پیگیری گزارش‌های من
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </motion.div>

        {/* Trust line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
        >
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          تصاویر با دوربین زنده و موقعیت قفل‌شده — ضدجعل
        </motion.div>

        {/* Stats */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3 sm:gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 + i * 0.08 }}
              className="glass px-3 py-5"
            >
              <div className="font-display text-3xl font-black text-slate-900 sm:text-4xl dark:text-white">
                <StatCounter value={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Feature cards */}
        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              className="glass group p-7 text-right"
            >
              <div
                className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${f.tint}`}
              >
                <f.icon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {f.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

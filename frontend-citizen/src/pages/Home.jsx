import { Camera, MapPin, Send, BellRing, Sparkles, Radio, MapPinned, ShieldCheck } from 'lucide-react'
import { EmergencyStrip } from '../components/EmergencyStrip'
import { EmergencyCenters } from '../components/EmergencyCenters'
import { DownloadApp } from '../components/DownloadApp'
import { Hero } from '../components/Hero'
import { SectionReveal } from '../components/ui/SectionReveal'
import { useReportModal } from '../components/report/ReportModal'

const steps = [
  { icon: Camera, title: 'ثبت تصویر زنده', text: 'با دوربین دستگاه، عکسِ معتبر و ضدجعل بگیرید.' },
  { icon: MapPin, title: 'قفل موقعیت', text: 'موقعیت دقیق از GPS دستگاه به‌صورت خودکار ثبت می‌شود.' },
  { icon: Send, title: 'ارسال گزارش', text: 'توضیح کوتاهی بنویسید و گزارش را ارسال کنید.' },
  { icon: BellRing, title: 'پیگیری زنده', text: 'وضعیت رسیدگی را لحظه‌به‌لحظه دنبال کنید.' },
]

const capabilities = [
  {
    icon: Sparkles,
    title: 'پردازش هوشمند',
    text: 'هوش مصنوعی دسته‌بندی و فوریت مشکل را به‌صورت خودکار تشخیص می‌دهد.',
    tone: 'text-beacon-500 bg-beacon-400/15',
  },
  {
    icon: Radio,
    title: 'پیگیری لحظه‌ای',
    text: 'وضعیت رسیدگی به‌صورت زنده از طریق وب‌سوکت به‌روزرسانی می‌شود.',
    tone: 'text-civic-500 bg-civic-500/15',
  },
  {
    icon: MapPinned,
    title: 'تحلیل مکانی',
    text: 'موقعیت دقیق شما روی نقشه‌های GIS ثبت و به شناسایی سریع بحران‌ها کمک می‌کند.',
    tone: 'text-sky-500 bg-sky-500/15',
  },
]

function ReportCta() {
  const { open } = useReportModal()
  return (
    <div className="relative overflow-hidden rounded-4xl border border-ink-700/50 bg-ink-900 p-8 text-center shadow-lift sm:p-12">
      <div className="pointer-events-none absolute inset-0 map-grid opacity-40" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-beacon-500/25 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-civic-500/20 blur-[100px]" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold text-slate-200">
          <ShieldCheck className="h-4 w-4 text-civic-400" />
          ثبت امن و ضدجعل
        </span>
        <h2 className="mt-5 font-display text-3xl font-black text-white sm:text-4xl">
          آماده‌اید مشکلی را گزارش دهید؟
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">
          در یک فرایند کوتاه و راهنمایی‌شده، تصویر و موقعیت را ثبت کنید و گزارش خود را در کمتر از
          یک دقیقه ارسال کنید.
        </p>
        <button type="button" onClick={open} className="btn-signal btn-lg mx-auto mt-7">
          <Sparkles className="h-5 w-5" />
          شروع ثبت گزارش
        </button>
      </div>
    </div>
  )
}

export function HomePage() {
  return (
    <div className="w-full">
      <Hero />

      {/* How it works — a real four-step sequence */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionReveal className="mb-10 text-center">
          <p className="eyebrow justify-center">مسیر گزارش</p>
          <h2 className="mt-3 font-display text-3xl font-black text-ink-900 sm:text-4xl dark:text-white">
            در چهار گام ساده
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            از مشاهدهٔ مشکل تا رسیدگی، همه‌چیز شفاف و سریع
          </p>
        </SectionReveal>

        <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <SectionReveal key={s.title} delay={i * 0.08} className="card group relative p-6 text-right">
              <span className="tnum absolute left-5 top-4 text-5xl font-black text-beacon-400/25 dark:text-beacon-400/15">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-beacon-400/15 text-beacon-600 transition group-hover:scale-105 dark:text-beacon-400">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-ink-900 dark:text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.text}</p>
            </SectionReveal>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {capabilities.map((f, i) => (
            <SectionReveal key={f.title} delay={i * 0.08} className="card p-7 text-right">
              <div className={`mb-4 flex h-13 w-13 items-center justify-center rounded-xl p-3 ${f.tone}`}>
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-ink-900 dark:text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.text}</p>
            </SectionReveal>
          ))}
        </div>
      </section>

      {/* Report CTA */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <SectionReveal>
          <ReportCta />
        </SectionReveal>
      </section>

      {/* Download mobile app */}
      <section id="download" className="mx-auto max-w-6xl px-4 py-12">
        <SectionReveal>
          <DownloadApp />
        </SectionReveal>
      </section>

      {/* Emergency info */}
      <section id="emergency" className="mx-auto max-w-4xl px-4 py-16">
        <SectionReveal className="mb-8 text-center">
          <p className="eyebrow justify-center">مواقع فوری</p>
          <h2 className="mt-3 font-display text-3xl font-black text-ink-900 sm:text-4xl dark:text-white">
            اطلاعات اضطراری
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            برای مواقع فوری، تماس مستقیم و مراکز نزدیک شما
          </p>
        </SectionReveal>

        <div className="space-y-6">
          <SectionReveal>
            <EmergencyStrip />
          </SectionReveal>
          <SectionReveal delay={0.05}>
            <EmergencyCenters />
          </SectionReveal>
        </div>
      </section>
    </div>
  )
}

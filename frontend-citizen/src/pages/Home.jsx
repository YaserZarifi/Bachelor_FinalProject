import { Camera, MapPin, Send, BellRing, Sparkles, ShieldCheck } from 'lucide-react'
import { EmergencyStrip } from '../components/EmergencyStrip'
import { EmergencyCenters } from '../components/EmergencyCenters'
import { Hero } from '../components/Hero'
import { SectionReveal } from '../components/ui/SectionReveal'
import { useReportModal } from '../components/report/ReportModal'

const steps = [
  { icon: Camera, title: 'ثبت تصویر زنده', text: 'با دوربین دستگاه، عکسِ معتبر و ضدجعل بگیرید.' },
  { icon: MapPin, title: 'قفل موقعیت', text: 'موقعیت دقیق از GPS دستگاه به‌صورت خودکار ثبت می‌شود.' },
  { icon: Send, title: 'ارسال گزارش', text: 'توضیح کوتاهی بنویسید و گزارش را ارسال کنید.' },
  { icon: BellRing, title: 'پیگیری زنده', text: 'وضعیت رسیدگی را لحظه‌به‌لحظه دنبال کنید.' },
]

function ReportCta() {
  const { open } = useReportModal()
  return (
    <div className="relative overflow-hidden rounded-5xl border border-white/50 bg-gradient-to-br from-brand-500/15 via-aurora-violet/10 to-aurora-cyan/15 p-8 text-center shadow-glass backdrop-blur-xl sm:p-12 dark:border-white/10">
      {/* decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-aurora-cyan/30 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-4 py-1.5 text-xs font-bold text-slate-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          ثبت امن و ضدجعل
        </span>
        <h2 className="mt-5 font-display text-3xl font-black text-slate-900 sm:text-4xl dark:text-white">
          آماده‌اید مشکلی را گزارش دهید؟
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
          در یک فرایند کوتاه و راهنمایی‌شده، تصویر و موقعیت را ثبت کنید و گزارش خود را در کمتر از
          یک دقیقه ارسال کنید.
        </p>
        <button
          type="button"
          onClick={open}
          className="btn-primary mx-auto mt-7 px-8 py-4 text-lg"
        >
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

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionReveal className="mb-10 text-center">
          <h2 className="font-display text-3xl font-black text-slate-900 sm:text-4xl dark:text-white">
            در چهار گام ساده
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            از مشاهدهٔ مشکل تا رسیدگی، همه‌چیز شفاف و سریع
          </p>
        </SectionReveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <SectionReveal key={s.title} delay={i * 0.08} className="glass relative p-6 text-right">
              <span className="absolute left-5 top-5 font-display text-5xl font-black text-brand-500/15 dark:text-white/10">
                {(i + 1).toLocaleString('fa-IR')}
              </span>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-aurora-cyan/20 text-brand-500 dark:text-brand-300">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.text}</p>
            </SectionReveal>
          ))}
        </div>
      </section>

      {/* Report CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-4">
        <SectionReveal>
          <ReportCta />
        </SectionReveal>
      </section>

      {/* Emergency info */}
      <section id="emergency" className="mx-auto max-w-4xl px-4 py-16">
        <SectionReveal className="mb-8 text-center">
          <h2 className="font-display text-3xl font-black text-slate-900 sm:text-4xl dark:text-white">
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

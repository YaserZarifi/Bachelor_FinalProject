import { Ambulance, Flame, Shield, AlertTriangle } from 'lucide-react'

const lines = [
  { href: 'tel:115', label: 'اورژانس', num: '۱۱۵', icon: Ambulance, cls: 'from-rose-600 to-rose-500' },
  { href: 'tel:125', label: 'آتش‌نشانی', num: '۱۲۵', icon: Flame, cls: 'from-orange-600 to-amber-500' },
  { href: 'tel:110', label: 'پلیس', num: '۱۱۰', icon: Shield, cls: 'from-slate-700 to-slate-600' },
]

export function EmergencyStrip() {
  return (
    <div className="rounded-4xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5 backdrop-blur-xl dark:border-amber-400/20">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white">اطلاعات مهم</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            این سامانه برای مسائل غیرفوری شهری است؛ برای اورژانس از تماس مستقیم با مراجع ذی‌ربط
            استفاده کنید.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {lines.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={`group inline-flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-l ${l.cls} px-4 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5`}
          >
            <span className="inline-flex items-center gap-2">
              <l.icon className="h-5 w-5" />
              {l.label}
            </span>
            <span className="font-display text-lg">{l.num}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

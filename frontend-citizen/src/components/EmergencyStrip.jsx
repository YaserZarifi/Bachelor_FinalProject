import { Ambulance, Flame, Shield, AlertTriangle } from 'lucide-react'

const lines = [
  { href: 'tel:115', label: 'اورژانس', num: '۱۱۵', icon: Ambulance, cls: 'btn-coral' },
  { href: 'tel:125', label: 'آتش‌نشانی', num: '۱۲۵', icon: Flame, cls: 'btn-signal' },
  { href: 'tel:110', label: 'پلیس', num: '۱۱۰', icon: Shield, cls: 'btn-primary' },
]

export function EmergencyStrip() {
  return (
    <div className="rounded-3xl border border-coral-400/30 bg-coral-50 p-5 dark:border-coral-400/20 dark:bg-coral-500/[0.07]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral-500/15 text-coral-600 dark:text-coral-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-ink-900 dark:text-white">اطلاعات مهم</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            این سامانه برای مسائل غیرفوری شهری است؛ برای موارد اورژانسی از تماس مستقیم با مراجع ذی‌ربط
            استفاده کنید.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {lines.map((l) => (
          <a key={l.href} href={l.href} className={`${l.cls} justify-between`}>
            <span className="inline-flex items-center gap-2">
              <l.icon className="h-5 w-5" />
              {l.label}
            </span>
            <span className="tnum text-lg">{l.num}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

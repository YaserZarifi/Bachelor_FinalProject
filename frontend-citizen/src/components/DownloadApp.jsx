import { Smartphone, Camera, MapPin, BellRing, ShieldCheck, Apple, Play } from 'lucide-react'
import { BeaconPin } from './ui/BeaconPin'

const features = [
  { icon: Camera, text: 'دوربین درون‌برنامه‌ای ضدجعل' },
  { icon: MapPin, text: 'موقعیت دقیق خودکار از GPS' },
  { icon: BellRing, text: 'اعلان لحظه‌ای تغییر وضعیت' },
  { icon: ShieldCheck, text: 'ثبت امن و قابل پیگیری' },
]

export function DownloadApp() {
  return (
    <div className="relative overflow-hidden rounded-4xl border border-ink-700/60 bg-ink-900 p-8 shadow-lift sm:p-12">
      <div className="pointer-events-none absolute inset-0 map-grid opacity-40" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-beacon-500/25 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-civic-500/20 blur-[100px]" />

      <div className="relative grid items-center gap-10 lg:grid-cols-2">
        {/* Copy */}
        <div className="text-right">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold text-white">
            <Smartphone className="h-4 w-4 text-beacon-400" />
            اپلیکیشن موبایل شهریاور
          </span>
          <h2 className="mt-5 font-display text-3xl font-black text-white sm:text-4xl">
            گزارش بده، هرجا که هستی
          </h2>
          <p className="mt-3 max-w-md text-slate-300">
            نسخهٔ موبایل شهریاور را نصب کن و مشکلات شهری را با دوربین و موقعیت دقیق، در چند ثانیه و
            حتی به‌صورت آفلاین ثبت کن. وضعیت رسیدگی را با اعلان زنده دنبال کن.
          </p>

          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f.text} className="flex items-center justify-end gap-2 text-sm text-slate-200">
                <span>{f.text}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-beacon-400">
                  <f.icon className="h-4 w-4" />
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <a
              href="#"
              className="group relative flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-white transition hover:bg-white/20"
            >
              <Play className="h-7 w-7 text-civic-400" />
              <span className="text-right leading-tight">
                <span className="block text-[10px] text-slate-300">دریافت از</span>
                <span className="block text-sm font-bold">گوگل‌پلی / فایل APK</span>
              </span>
            </a>
            <a
              href="#"
              className="group flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-white transition hover:bg-white/20"
            >
              <Apple className="h-7 w-7" />
              <span className="text-right leading-tight">
                <span className="block text-[10px] text-slate-300">دریافت از</span>
                <span className="block text-sm font-bold">App Store</span>
              </span>
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            برای توسعه: اپ با <span className="font-bold text-slate-200">Expo Go</span> از پوشهٔ
            <span dir="ltr" className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono">mobile/</span>
            قابل اجراست.
          </p>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center lg:justify-start">
          <div className="relative h-[460px] w-[230px] rounded-[2.5rem] border-[6px] border-white/15 bg-ink-950 shadow-signal-lg">
            <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/70" />
            <div className="flex h-full flex-col gap-3 overflow-hidden rounded-[2rem] bg-gradient-to-b from-ink-850 to-ink-950 p-4 pt-8">
              <div className="flex items-center justify-between">
                <BeaconPin size={34} />
                <span className="font-display text-lg font-black text-white">شهریاور</span>
              </div>
              <div className="rounded-2xl bg-beacon-400 p-4 text-right text-ink-900 shadow-signal">
                <p className="text-xs font-semibold opacity-80">ثبت گزارش جدید</p>
                <p className="mt-1 text-base font-black">شروع کن</p>
              </div>
              <div className="space-y-2">
                {[
                  { s: 'در حال بررسی', c: 'bg-sky-400' },
                  { s: 'در حال اقدام', c: 'bg-beacon-400' },
                  { s: 'حل‌شده', c: 'bg-civic-400' },
                ].map((row) => (
                  <div key={row.s} className="flex items-center justify-end gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
                    <span className="text-xs text-slate-200">{row.s}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${row.c}`} />
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-around rounded-2xl border border-white/10 bg-white/5 py-3 text-slate-300">
                <BellRing className="h-5 w-5" />
                <MapPin className="h-5 w-5" />
                <span className="flex h-10 w-10 -translate-y-3 items-center justify-center rounded-full bg-beacon-400 text-ink-900 shadow-signal">
                  <Camera className="h-5 w-5" />
                </span>
                <Smartphone className="h-5 w-5" />
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

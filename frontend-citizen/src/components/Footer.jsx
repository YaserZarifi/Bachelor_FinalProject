import { Link } from 'react-router-dom'
import { MapPin, Github, Mail, ShieldCheck } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-16 px-3 pb-6 sm:px-4">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-4xl border border-white/50 bg-white/70 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-glass-dark">
        <div className="grid gap-8 p-8 sm:grid-cols-3 sm:p-10">
          <div className="sm:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-aurora-violet text-white shadow-glow">
                <MapPin className="h-6 w-6" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white">شهریاور</div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              پل ارتباطی سریع و شفاف میان شما و مدیریت شهری. با مشارکت مدنی، در ساختن شهری
              هوشمند، ایمن و زیبا سهیم باشیم.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">دسترسی سریع</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link to="/" className="transition hover:text-brand-600 dark:hover:text-brand-300">
                  ثبت گزارش
                </Link>
              </li>
              <li>
                <Link to="/reports" className="transition hover:text-brand-600 dark:hover:text-brand-300">
                  پیگیری گزارش‌ها
                </Link>
              </li>
              <li>
                <Link to="/login" className="transition hover:text-brand-600 dark:hover:text-brand-300">
                  ورود شهروندان
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">ارتباط با ما</h4>
            <div className="mt-4 flex gap-3">
              <a
                href="#"
                aria-label="ایمیل"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/60 text-slate-600 transition hover:text-brand-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <Mail className="h-5 w-5" />
              </a>
              <a
                href="#"
                aria-label="گیت‌هاب"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/60 text-slate-600 transition hover:text-brand-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              داده‌های شما رمزنگاری و محافظت می‌شوند
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200/70 px-8 py-5 text-center text-xs text-slate-500 sm:px-10 dark:border-white/10 dark:text-slate-400">
          © {new Date().getFullYear()} دانشگاه صنعتی امیرکبیر — پروژهٔ کارشناسی شهریاور
        </div>
      </div>
    </footer>
  )
}

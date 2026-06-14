import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Menu, X, FileText, LogIn, Plus } from 'lucide-react'
import { ThemeToggle } from './ui/ThemeToggle'
import { useReportModal } from './report/ReportModal'

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 transition hover:opacity-90">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-aurora-violet text-white shadow-glow">
        <MapPin className="h-6 w-6" />
        <span className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-ink" />
      </div>
      <div className="leading-tight">
        <div className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
          شهریاور
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">
          UrbanHelper
        </div>
      </div>
    </Link>
  )
}

export function Navbar() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const { open: openReport } = useReportModal()
  const isReports = location.pathname === '/reports'

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-3xl border border-white/50 bg-white/70 px-4 py-2.5 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-glass-dark">
        <Brand />

        {/* Desktop */}
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            to="/reports"
            className={`relative rounded-xl px-4 py-2 text-sm font-bold transition ${
              isReports
                ? 'text-brand-600 dark:text-brand-300'
                : 'text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-300'
            }`}
          >
            گزارش‌های من
            {isReports && (
              <motion.span
                layoutId="nav-underline"
                className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-l from-brand-500 to-aurora-cyan"
              />
            )}
          </Link>
          <ThemeToggle />
          <Link to="/login" className="btn-ghost px-4 py-2 text-sm">
            <LogIn className="h-4 w-4" />
            ورود
          </Link>
          <button type="button" onClick={openReport} className="btn-primary text-sm">
            <Plus className="h-4 w-4" />
            ثبت گزارش
          </button>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="منو"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-2 max-w-6xl space-y-2 rounded-3xl border border-white/50 bg-white/80 p-3 shadow-glass backdrop-blur-xl sm:hidden dark:border-white/10 dark:bg-slate-900/80"
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openReport()
              }}
              className="btn-primary w-full"
            >
              <Plus className="h-4 w-4" />
              ثبت گزارش
            </button>
            <Link
              to="/reports"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-2xl px-4 py-3 font-bold text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <FileText className="h-5 w-5 text-brand-500" />
              گزارش‌های من
            </Link>
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="btn-ghost w-full"
            >
              <LogIn className="h-4 w-4" />
              ورود
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

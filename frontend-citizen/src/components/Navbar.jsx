import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, FileText, LogIn, LogOut, Plus, Smartphone, User } from 'lucide-react'
import { ThemeToggle } from './ui/ThemeToggle'
import { BrandLockup } from './ui/BeaconPin'
import { useReportModal } from './report/ReportModal'
import { useAuth } from '../hooks/useAuth.js'
import { logoutClient } from '../api/client.js'
import { useToast } from './ui/Toast.jsx'

export function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { open: openReport } = useReportModal()
  const { authed, username } = useAuth()
  const toast = useToast()
  const isReports = location.pathname === '/reports'

  // Close the mobile drawer on route change and on Escape.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false)
  }, [location.pathname])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleLogout() {
    logoutClient()
    toast.push('از حساب خود خارج شدید', 'info')
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-2.5 shadow-card backdrop-blur-md dark:border-white/[0.08] dark:bg-ink-850/85 dark:shadow-card-dark">
        <Link to="/" aria-label="خانه" className="transition hover:opacity-90">
          <BrandLockup />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 sm:flex">
          <a
            href="/#download"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:text-beacon-600 dark:text-slate-300 dark:hover:text-beacon-300"
          >
            <Smartphone className="h-4 w-4" />
            دانلود اپ
          </a>
          <Link
            to="/reports"
            className={`relative rounded-lg px-3 py-2 text-sm font-bold transition ${
              isReports
                ? 'text-beacon-600 dark:text-beacon-300'
                : 'text-slate-600 hover:text-beacon-600 dark:text-slate-300 dark:hover:text-beacon-300'
            }`}
          >
            گزارش‌های من
            {isReports && (
              <motion.span
                layoutId="nav-underline"
                className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-beacon-400"
              />
            )}
          </Link>
          <ThemeToggle className="mx-1" />
          {authed ? (
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                <User className="h-4 w-4 text-civic-500" />
                {username}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="خروج"
                className="btn-ghost btn-sm"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-ghost btn-sm">
              <LogIn className="h-4 w-4" />
              ورود
            </Link>
          )}
          <button type="button" onClick={openReport} className="btn-signal btn-sm mr-1">
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
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
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
            className="card-raised mx-auto mt-2 max-w-6xl space-y-2 p-3 sm:hidden"
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openReport()
              }}
              className="btn-signal w-full"
            >
              <Plus className="h-4 w-4" />
              ثبت گزارش
            </button>
            <Link
              to="/reports"
              className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <FileText className="h-5 w-5 text-beacon-500" />
              گزارش‌های من
            </Link>
            <a
              href="/#download"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <Smartphone className="h-5 w-5 text-beacon-500" />
              دانلود اپ موبایل
            </a>
            {authed ? (
              <button type="button" onClick={handleLogout} className="btn-ghost w-full">
                <LogOut className="h-4 w-4" />
                خروج ({username})
              </button>
            ) : (
              <Link to="/login" className="btn-ghost w-full">
                <LogIn className="h-4 w-4" />
                ورود
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

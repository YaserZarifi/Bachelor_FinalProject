import { useState } from 'react'
import { KeyRound, Search, Loader2, AlertTriangle, ChevronDown } from 'lucide-react'
import { fetchReport, saveGuestReport } from '../../api/client'

/**
 * Lets a guest re-attach a previously submitted report using its report ID + guest
 * token (issued once at submit time). Useful on a new device or after clearing storage.
 * On success, persists the token locally and hands the flattened report to `onTracked`.
 */
export function TrackByToken({ onTracked }) {
  const [open, setOpen] = useState(false)
  const [reportId, setReportId] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    const id = reportId.trim()
    const tk = token.trim()
    if (!id || !tk) {
      setError('شمارهٔ گزارش و توکن پیگیری را وارد کنید.')
      return
    }
    setBusy(true)
    try {
      const flat = await fetchReport(id, tk)
      if (!flat?.id) throw new Error('not-found')
      // Persist so it survives reloads and appears in the tracked list.
      saveGuestReport({
        id: flat.id,
        token: tk,
        description: (flat.description || '').slice(0, 120),
      })
      setReportId('')
      setToken('')
      onTracked?.(flat)
    } catch {
      setError('گزارشی با این شماره و توکن یافت نشد. مقادیر را بررسی کنید.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/[0.08] dark:bg-ink-850">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-900 dark:text-white">
          <KeyRound className="h-4 w-4 text-beacon-500" />
          پیگیری گزارش مهمان با توکن
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-slate-200/70 px-4 py-4 dark:border-white/10">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            اگر گزارشی را به‌صورت مهمان ثبت کرده‌اید، با وارد کردن شمارهٔ گزارش و توکن پیگیری آن
            می‌توانید روند رسیدگی را دنبال کنید.
          </p>
          <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
            <div>
              <label className="label">شمارهٔ گزارش</label>
              <input
                type="number"
                inputMode="numeric"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className="input tnum"
                placeholder="۱۲۳"
              />
            </div>
            <div>
              <label className="label">توکن پیگیری</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="input font-mono text-left"
                dir="ltr"
                placeholder="guest token…"
                autoComplete="off"
              />
            </div>
          </div>

          {error && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-coral-400/30 bg-coral-500/10 px-3 py-2 text-xs font-semibold text-coral-700 dark:text-coral-300">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {busy ? 'در حال جست‌وجو…' : 'یافتن و پیگیری'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

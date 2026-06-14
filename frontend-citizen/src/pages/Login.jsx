import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, User, Lock, AlertCircle, ArrowRight, MapPin } from 'lucide-react'
import { api, loginTokens } from '../api/client'
import { PasswordInput } from '../components/ui/PasswordInput'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('auth/token/', { username, password })
      loginTokens(res.data.access, res.data.refresh)
      navigate('/reports')
    } catch {
      setError('نام کاربری یا رمز نادرست است.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong p-8"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-aurora-violet text-white shadow-glow">
            <MapPin className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-brand-500">ورود شهروند</p>
          <h2 className="font-display text-3xl font-black text-slate-900 dark:text-white">شهریاور</h2>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="label inline-flex items-center gap-1.5">
              <User className="h-4 w-4 text-brand-500" />
              نام کاربری
            </label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-brand-500" />
              رمز عبور
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
            <LogIn className="h-5 w-5" />
            {loading ? 'در حال ورود…' : 'ورود'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          حساب ندارید؟{' '}
          <Link className="font-bold text-brand-600 dark:text-brand-300" to="/register">
            ثبت‌نام
          </Link>
        </div>
        <Link
          className="mt-3 inline-flex w-full items-center justify-center gap-1 text-center text-sm text-slate-500 transition hover:text-brand-600 dark:text-slate-400"
          to="/"
        >
          بازگشت به خانه
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  )
}

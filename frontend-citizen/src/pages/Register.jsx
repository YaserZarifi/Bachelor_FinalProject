import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserPlus, User, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'
import { api, loginTokens } from '../api/client'
import { PasswordInput } from '../components/ui/PasswordInput'

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('auth/register/', { username, email, password })
      const tok = await api.post('auth/token/', { username, password })
      loginTokens(tok.data.access, tok.data.refresh)
      navigate('/reports')
    } catch {
      setError('ثبت‌نام ناموفق بود (کاربر تکراری یا دادهٔ نادرست).')
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-violet to-brand-500 text-white shadow-glow">
            <UserPlus className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-brand-500">ایجاد حساب شهروندی</p>
          <h2 className="font-display text-3xl font-black text-slate-900 dark:text-white">ثبت‌نام</h2>
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
              required
            />
          </div>
          <div>
            <label className="label inline-flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-brand-500" />
              ایمیل
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-brand-500" />
              رمز عبور
            </label>
            <PasswordInput
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
            <UserPlus className="h-5 w-5" />
            {loading ? 'در حال ثبت…' : 'ثبت‌نام و ورود'}
          </button>
        </form>

        <Link
          className="mt-5 inline-flex w-full items-center justify-center gap-1 text-center text-sm text-slate-500 transition hover:text-brand-600 dark:text-slate-400"
          to="/login"
        >
          قبلاً ثبت‌نام کرده‌ام
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserPlus, User, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'
import { api, loginTokens } from '../api/client'
import { PasswordInput } from '../components/ui/PasswordInput'
import { BeaconPin } from '../components/ui/BeaconPin'
import { useToast } from '../components/ui/Toast.jsx'

export function RegisterPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (username.trim().length < 3) {
      setError('نام کاربری باید حداقل ۳ نویسه باشد.')
      return
    }
    if (password.length < 8) {
      setError('رمز عبور باید حداقل ۸ نویسه باشد.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('auth/register/', { username, email, password })
      const tok = await api.post('auth/token/', { username, password })
      loginTokens(tok.data.access, tok.data.refresh)
      toast.push('حساب شما ساخته شد 🎉', 'success')
      navigate('/reports')
    } catch (err) {
      const data = err?.response?.data
      const first =
        data?.username?.[0] || data?.email?.[0] || data?.password?.[0] || data?.detail
      setError(first || 'ثبت‌نام ناموفق بود (کاربر تکراری یا دادهٔ نادرست).')
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
        className="card-raised p-8"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <BeaconPin size={52} />
          </div>
          <p className="text-sm font-bold text-beacon-600 dark:text-beacon-400">ایجاد حساب شهروندی</p>
          <h1 className="font-display text-3xl font-black text-ink-900 dark:text-white">ثبت‌نام</h1>
        </div>

        <form className="space-y-4" onSubmit={submit} noValidate>
          <div>
            <label className="label inline-flex items-center gap-1.5">
              <User className="h-4 w-4 text-beacon-500" />
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
              <Mail className="h-4 w-4 text-beacon-500" />
              ایمیل <span className="text-slate-400">(اختیاری)</span>
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-beacon-500" />
              رمز عبور
            </label>
            <PasswordInput
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="mt-1.5 text-xs text-slate-400">حداقل ۸ نویسه</p>
          </div>

          {error && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-coral-400/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-600 dark:text-coral-300">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            <UserPlus className="h-5 w-5" />
            {loading ? 'در حال ثبت…' : 'ثبت‌نام و ورود'}
          </button>
        </form>

        <Link
          className="mt-5 inline-flex w-full items-center justify-center gap-1 text-center text-sm text-slate-500 transition hover:text-beacon-600 dark:text-slate-400"
          to="/login"
        >
          قبلاً ثبت‌نام کرده‌ام
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  )
}

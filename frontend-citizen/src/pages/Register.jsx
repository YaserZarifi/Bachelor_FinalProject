import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, loginTokens } from '../api/client'

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      await api.post('auth/register/', { username, email, password })
      const tok = await api.post('auth/token/', { username, password })
      loginTokens(tok.data.access, tok.data.refresh)
      navigate('/reports')
    } catch {
      setError('ثبت‌نام ناموفق بود (کاربر تکراری یا داده نادرست).')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
      <div>
        <p className="text-sm text-slate-500">ایجاد حساب شهروندی</p>
        <h2 className="text-2xl font-bold text-slate-900">ثبت‌نام</h2>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="mb-1 block text-sm text-slate-600">نام کاربری</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-brand-600 focus:ring-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">ایمیل</label>
          <input
            type="email"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-brand-600 focus:ring-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">رمز عبور</label>
          <input
            type="password"
            minLength={8}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-brand-600 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button
          type="submit"
          className="w-full rounded-2xl bg-brand-700 py-3 font-bold text-white shadow hover:bg-brand-900"
        >
          ثبت‌نام و ورود
        </button>
      </form>
      <Link className="block text-center text-sm text-slate-500" to="/login">
        قبلاً ثبت‌نام کرده‌ام
      </Link>
    </div>
  )
}

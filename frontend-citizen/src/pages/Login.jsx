import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, loginTokens } from '../api/client'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await api.post('auth/token/', { username, password })
      loginTokens(res.data.access, res.data.refresh)
      navigate('/reports')
    } catch {
      setError('نام کاربری یا رمز نادرست است.')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
      <div>
        <p className="text-sm text-slate-500">ورود شهروند</p>
        <h2 className="text-2xl font-bold text-slate-900">شهریاور</h2>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="mb-1 block text-sm text-slate-600">نام کاربری</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-brand-600 focus:ring-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">رمز عبور</label>
          <input
            type="password"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-brand-600 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button
          type="submit"
          className="w-full rounded-2xl bg-brand-700 py-3 font-bold text-white shadow hover:bg-brand-900"
        >
          ورود
        </button>
      </form>
      <div className="text-center text-sm text-slate-600">
        حساب ندارید؟{' '}
        <Link className="font-semibold text-brand-700" to="/register">
          ثبت‌نام
        </Link>
      </div>
      <Link className="block text-center text-sm text-slate-500" to="/">
        بازگشت به خانه
      </Link>
    </div>
  )
}

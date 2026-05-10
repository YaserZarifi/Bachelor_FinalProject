import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, loginTokens } from '../api/client'

export default function LoginPage() {
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
      navigate('/')
    } catch {
      setError('ورود ناموفق است یا دسترسی غیرمجاز.')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <p className="text-sm text-slate-300">UrbanHelper Admin</p>
        <h1 className="mt-2 text-3xl font-black text-white">ورود مدیر</h1>
        <form className="mt-8 space-y-4" onSubmit={submit}>
          <div>
            <label className="text-sm text-slate-300">نام کاربری</label>
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-sky-400 focus:ring-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300">رمز عبور</label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-sky-400 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="text-sm text-rose-300">{error}</div>}
          <button
            type="submit"
            className="w-full rounded-2xl bg-sky-500 py-3 font-bold text-slate-950 shadow-lg hover:bg-sky-400"
          >
            ورود به داشبورد
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          نیاز به نقش کارمند (staff) در Django دارید.
        </p>
        <Link className="mt-4 block text-center text-sm text-slate-400" to="/">
          بازگشت
        </Link>
      </div>
    </div>
  )
}

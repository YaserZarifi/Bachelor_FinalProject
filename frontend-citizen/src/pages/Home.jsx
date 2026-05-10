import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmergencyStrip } from '../components/EmergencyStrip'
import { ReportForm } from '../components/ReportForm'

export function HomePage() {
  const [guest, setGuest] = useState(null)

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          UrbanHelper
        </p>
        <h1 className="text-4xl font-black text-slate-900">شهریاور</h1>
        <p className="text-sm text-slate-600">
          گزارش معضلات شهری با نقشه، تصویر و پیگیری لحظه‌ای وضعیت
        </p>
        <div className="flex justify-center gap-3 text-sm font-semibold">
          <Link className="rounded-full bg-brand-700 px-5 py-2 text-white shadow" to="/login">
            ورود شهروند
          </Link>
          <Link
            className="rounded-full border border-brand-200 px-5 py-2 text-brand-800"
            to="/reports"
          >
            گزارش‌های من
          </Link>
        </div>
      </header>
      <EmergencyStrip />
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
        <ReportForm
          onSubmitted={(payload) => {
            setGuest(payload)
          }}
        />
        {guest?.guestToken && (
          <div className="mt-6 rounded-2xl bg-slate-900 p-4 text-sm text-white shadow-inner">
            <p className="font-semibold">توکن پیگیری مهمان</p>
            <p className="mt-2 break-all text-xs text-slate-200">{guest.guestToken}</p>
            <p className="mt-2 text-xs text-slate-400">
              این توکن را برای اتصال زنده به وضعیت گزارش #{guest.id} نگه دارید.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

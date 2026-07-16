import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Password field with a show/hide toggle. Spreads any extra props onto the
 * underlying <input> (value, onChange, minLength, required, autoComplete…).
 */
export function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={`input pl-12 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
        title={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
        className="absolute inset-y-0 left-3 flex items-center text-slate-400 transition hover:text-beacon-500"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  )
}

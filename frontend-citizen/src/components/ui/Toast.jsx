import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'

const ToastContext = createContext({ push: () => {}, dismiss: () => {} })

const TONE = {
  success: {
    icon: CheckCircle2,
    ring: 'border-civic-500/30',
    accent: 'text-civic-500',
    bar: 'bg-civic-500',
  },
  error: {
    icon: XCircle,
    ring: 'border-coral-500/30',
    accent: 'text-coral-500',
    bar: 'bg-coral-500',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-beacon-400/40',
    accent: 'text-beacon-500',
    bar: 'bg-beacon-400',
  },
  info: {
    icon: Info,
    ring: 'border-sky-500/30',
    accent: 'text-sky-500',
    bar: 'bg-sky-500',
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = ++idRef.current
      setToasts((list) => [...list, { id, message, type }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => {
            const tone = TONE[t.type] || TONE.info
            const Icon = tone.icon
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={`card-raised pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden border ${tone.ring} p-3.5 pr-4`}
                role="status"
              >
                <span className={`absolute inset-y-0 right-0 w-1 ${tone.bar}`} />
                <Icon className={`mt-0.5 shrink-0 ${tone.accent}`} size={20} />
                <p className="flex-1 text-sm font-semibold leading-relaxed text-ink-900 dark:text-slate-100">
                  {t.message}
                </p>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="بستن"
                  className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}

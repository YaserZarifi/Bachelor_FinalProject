import { motion, useReducedMotion } from 'framer-motion'
import { STATUS_ORDER, statusMeta, statusIndex } from '../../lib/status.js'

/**
 * The report lifecycle rendered as a civic "metro line" — stations the
 * report travels through. The travelled segment self-draws to the current
 * station. A genuine sequence, so the station device is earned.
 */
export function CivicLine({ status, className = '' }) {
  const reduce = useReducedMotion()
  const currentIdx = Math.max(0, statusIndex(status))
  const total = STATUS_ORDER.length
  const progress = total > 1 ? (currentIdx / (total - 1)) * 100 : 0

  return (
    <div className={`relative ${className}`}>
      {/* base track (runs along the inline-start / right edge in RTL) */}
      <div className="absolute right-[19px] top-3 bottom-3 w-0.5 rounded-full bg-slate-200 dark:bg-white/10" />
      {/* travelled segment */}
      <motion.div
        className="absolute right-[19px] top-3 w-0.5 rounded-full bg-gradient-to-b from-sky-400 via-beacon-400 to-civic-500"
        initial={reduce ? false : { height: 0 }}
        animate={{ height: `calc(${progress}% * (100% - 24px) / 100 )` }}
        style={{ maxHeight: 'calc(100% - 24px)' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <ol className="relative space-y-1">
        {STATUS_ORDER.map((key, i) => {
          const meta = statusMeta(key)
          const Icon = meta.icon
          const done = i < currentIdx
          const current = i === currentIdx
          const state = done ? 'done' : current ? 'current' : 'upcoming'
          return (
            <motion.li
              key={key}
              className="flex items-center gap-3 py-1.5"
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduce ? 0 : 0.1 + i * 0.08, duration: 0.4 }}
            >
              <span
                className={[
                  'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  state === 'done' &&
                    'border-transparent bg-civic-500 text-white',
                  state === 'current' &&
                    'border-beacon-400 bg-beacon-400 text-ink-900',
                  state === 'upcoming' &&
                    'border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-ink-800 dark:text-slate-500',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {current && !reduce && (
                  <span className="absolute inset-0 animate-signal-ping rounded-full bg-beacon-400/50" />
                )}
                <Icon size={17} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <p
                  className={[
                    'text-sm font-bold',
                    state === 'upcoming'
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'text-ink-900 dark:text-white',
                  ].join(' ')}
                >
                  {meta.label}
                </p>
                {current && (
                  <p className="text-xs font-semibold text-beacon-600 dark:text-beacon-400">
                    مرحلهٔ کنونی
                  </p>
                )}
              </div>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

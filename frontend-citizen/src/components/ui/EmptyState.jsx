import { motion } from 'framer-motion'
import { BeaconPin } from './BeaconPin.jsx'

/** Friendly, on-brand empty/zero state. An empty screen is an invitation to act. */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-50 dark:border-white/10 dark:bg-ink-800">
        {Icon ? (
          <Icon className="text-slate-400" size={30} strokeWidth={1.8} />
        ) : (
          <BeaconPin size={38} />
        )}
      </div>
      <h3 className="text-lg font-black text-ink-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  )
}

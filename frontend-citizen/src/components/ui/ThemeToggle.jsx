import { Moon, Sun } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../theme/ThemeProvider'

export function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'حالت روشن' : 'حالت تاریک'}
      title={isDark ? 'حالت روشن' : 'حالت تاریک'}
      className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/70 text-slate-700 shadow-sm backdrop-blur transition hover:text-brand-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:text-brand-300 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

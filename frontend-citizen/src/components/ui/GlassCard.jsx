import { motion } from 'framer-motion'

/**
 * A frosted-glass surface. Pass `strong` for a more opaque variant (forms,
 * primary panels) and `hover` to enable a subtle lift on hover.
 */
export function GlassCard({ children, className = '', strong = false, hover = false, ...rest }) {
  const base = strong ? 'glass-strong' : 'glass'
  return (
    <motion.div
      className={`${base} ${hover ? 'transition-transform duration-300 hover:-translate-y-1' : ''} ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

import { motion } from 'framer-motion'

/**
 * Scroll-reveal wrapper: fades + slides children in once they enter the
 * viewport. Use `delay` to stagger siblings.
 */
export function SectionReveal({ children, className = '', delay = 0, y = 24 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

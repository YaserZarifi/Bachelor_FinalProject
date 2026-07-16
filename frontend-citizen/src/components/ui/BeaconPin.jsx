import { motion, useReducedMotion } from 'framer-motion'

/**
 * The signature brand mark: a location pin emitting a signal.
 * `pulse` adds a radiating ring (used as an active/live indicator).
 */
export function BeaconPin({ size = 40, pulse = false, className = '' }) {
  const reduce = useReducedMotion()
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {pulse && !reduce && (
        <span className="absolute inset-0 animate-signal-ping rounded-full bg-beacon-400/40" />
      )}
      <motion.svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        initial={reduce ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="relative drop-shadow-[0_6px_14px_rgba(242,162,13,0.4)]"
      >
        {/* signal ring */}
        <circle
          cx="24"
          cy="19"
          r="15"
          stroke="currentColor"
          strokeWidth="1.6"
          className="text-beacon-400/40"
        />
        {/* pin body */}
        <path
          d="M24 6c-6.2 0-11 4.7-11 10.7 0 7.6 9.4 17.4 10.4 18.4a.9.9 0 0 0 1.3 0C25.6 34.1 35 24.3 35 16.7 35 10.7 30.2 6 24 6Z"
          fill="url(#beaconGrad)"
        />
        <circle cx="24" cy="16.4" r="4.4" className="fill-ink-900" />
        <circle cx="24" cy="16.4" r="1.9" className="fill-civic-400" />
        <defs>
          <linearGradient id="beaconGrad" x1="13" y1="6" x2="35" y2="35">
            <stop stopColor="#f9c95a" />
            <stop offset="1" stopColor="#f2a20d" />
          </linearGradient>
        </defs>
      </motion.svg>
    </span>
  )
}

/** Compact wordmark lockup for the navbar / footer. */
export function BrandLockup({ size = 36 }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BeaconPin size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-black tracking-tight text-ink-900 dark:text-white">
          شهریاور
        </span>
        <span className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          UrbanHelper
        </span>
      </span>
    </span>
  )
}

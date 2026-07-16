import { useReducedMotion } from 'framer-motion'

/**
 * Ambient civic backdrop: a faint wayfinding map-grid plus two soft
 * signal glows (amber + emerald). Replaces the old aurora blobs with a
 * calmer, higher-contrast surface. Purely decorative.
 */
export function CivicBackground() {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* wayfinding grid */}
      <div
        className={`absolute inset-0 map-grid opacity-60 ${
          reduce ? '' : 'motion-safe:animate-grid-pan'
        }`}
      />
      {/* horizon wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#eef1f7] dark:to-ink-950" />
      {/* amber signal glow, top-start */}
      <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-beacon-400/20 blur-[120px] dark:bg-beacon-500/10" />
      {/* emerald civic glow, bottom-end */}
      <div className="absolute -left-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-civic-400/15 blur-[120px] dark:bg-civic-500/10" />
    </div>
  )
}

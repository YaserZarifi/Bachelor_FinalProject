/**
 * Fixed, slowly-drifting aurora gradient mesh painted behind all content.
 * Subtle in light mode, richer in dark mode. Purely decorative.
 */
export function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      {/* Base wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50/60 via-white to-white dark:from-ink dark:via-[#0a0f24] dark:to-ink" />

      {/* Drifting colour blobs */}
      <div className="aurora-blob -left-32 -top-24 h-[28rem] w-[28rem] animate-blob bg-brand-400/40 dark:bg-brand-600/30" />
      <div className="aurora-blob right-[-8rem] top-10 h-[26rem] w-[26rem] animate-blob-slow bg-aurora-cyan/30 dark:bg-aurora-cyan/20" />
      <div className="aurora-blob bottom-[-10rem] left-1/3 h-[30rem] w-[30rem] animate-blob bg-aurora-fuchsia/20 dark:bg-aurora-violet/25" />
      <div className="aurora-blob bottom-10 right-1/4 h-[22rem] w-[22rem] animate-blob-slow bg-aurora-teal/25 dark:bg-aurora-teal/15" />

      {/* Fine grid overlay for that command-center texture */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.6) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />
    </div>
  )
}

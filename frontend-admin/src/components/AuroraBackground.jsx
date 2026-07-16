import { Box, useTheme } from '@mui/material'

/**
 * Fixed "Civic Signal" backdrop: a faint wayfinding grid with two soft signal
 * glows (amber + emerald). Shares the citizen app's visual language. Decorative.
 */
export default function AuroraBackground() {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'

  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: dark
          ? 'linear-gradient(180deg,#0b1220 0%,#0d1526 60%,#0b1220 100%)'
          : 'linear-gradient(180deg,#f4f6fa 0%,#ffffff 55%,#eef1f7 100%)',
      }}
    >
      {/* amber signal glow */}
      <Box
        component="span"
        sx={{
          position: 'absolute',
          top: -140,
          right: -100,
          width: 480,
          height: 480,
          borderRadius: '50%',
          filter: 'blur(120px)',
          background: dark ? 'rgba(242,162,13,0.14)' : 'rgba(249,181,38,0.28)',
        }}
      />
      {/* emerald civic glow */}
      <Box
        component="span"
        sx={{
          position: 'absolute',
          bottom: -160,
          left: -120,
          width: 460,
          height: 460,
          borderRadius: '50%',
          filter: 'blur(120px)',
          background: dark ? 'rgba(16,185,129,0.12)' : 'rgba(52,211,153,0.22)',
        }}
      />
      {/* wayfinding grid */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: dark ? 0.05 : 0.045,
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.7) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </Box>
  )
}

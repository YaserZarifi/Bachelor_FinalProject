import { Box, useTheme } from '@mui/material'

/**
 * Fixed aurora gradient mesh behind the whole admin shell. Shares the citizen
 * app's visual language. Decorative only.
 */
export default function AuroraBackground() {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'

  const blob = (extra) => ({
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(90px)',
    willChange: 'transform',
    ...extra,
  })

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
          ? 'linear-gradient(180deg,#070b1a 0%,#0a0f24 60%,#070b1a 100%)'
          : 'linear-gradient(180deg,#eef2ff 0%,#ffffff 60%,#eef2ff 100%)',
        '@keyframes blob': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.12)' },
          '66%': { transform: 'translate(-24px,22px) scale(0.92)' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& > span': { animation: 'none !important' },
        },
      }}
    >
      <Box component="span" sx={blob({ top: -120, right: -80, width: 460, height: 460, background: dark ? 'rgba(99,102,241,0.30)' : 'rgba(129,140,248,0.45)', animation: 'blob 20s ease-in-out infinite' })} />
      <Box component="span" sx={blob({ top: 40, left: -100, width: 420, height: 420, background: dark ? 'rgba(6,182,212,0.22)' : 'rgba(34,211,238,0.30)', animation: 'blob 28s ease-in-out infinite' })} />
      <Box component="span" sx={blob({ bottom: -140, left: '35%', width: 500, height: 500, background: dark ? 'rgba(139,92,246,0.25)' : 'rgba(217,70,239,0.20)', animation: 'blob 24s ease-in-out infinite' })} />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: dark ? 0.06 : 0.04,
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.6) 1px,transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />
    </Box>
  )
}

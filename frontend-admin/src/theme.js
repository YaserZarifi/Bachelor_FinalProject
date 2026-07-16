import { createTheme, alpha } from '@mui/material/styles'

// ── "Civic Signal" palette (shared with citizen + mobile) ──────────────
const BEACON = '#f2a20d' // amber — primary signal / attention
const BEACON_LIGHT = '#f9b526'
const BEACON_DARK = '#d67f04'
const CIVIC = '#10b981' // emerald — resolved / service / success
const SKY = '#0ea5e9' // info / in-progress
const CORAL = '#f43f5e' // urgent / error
const INK = '#0b1220'

/**
 * Build the "Civic Signal" MUI theme for the given mode ('light' | 'dark').
 * Solid, confident, data-dense surfaces (light blur, high opacity) so charts
 * and tables stay legible over the ambient background.
 */
export function createAppTheme(mode = 'dark') {
  const isDark = mode === 'dark'

  const paperBg = isDark ? alpha('#101a2e', 0.82) : alpha('#ffffff', 0.9)
  const borderColor = isDark ? alpha('#ffffff', 0.09) : alpha('#1e293b', 0.09)

  return createTheme({
    direction: 'rtl',
    typography: {
      fontFamily: 'Vazirmatn, system-ui, sans-serif',
      h4: { fontWeight: 900, letterSpacing: '-0.02em' },
      h5: { fontWeight: 900, letterSpacing: '-0.01em' },
      h6: { fontWeight: 800 },
      button: { fontWeight: 700 },
    },
    shape: { borderRadius: 14 },
    palette: {
      mode,
      primary: { main: BEACON, light: BEACON_LIGHT, dark: BEACON_DARK, contrastText: INK },
      secondary: { main: CIVIC, contrastText: '#ffffff' },
      info: { main: SKY, contrastText: '#ffffff' },
      warning: { main: '#f59e0b' },
      error: { main: CORAL },
      success: { main: CIVIC },
      background: {
        default: isDark ? '#0b1220' : '#f4f6fa',
        paper: isDark ? '#101a2e' : '#ffffff',
      },
      divider: borderColor,
      text: {
        primary: isDark ? '#e8edf6' : '#0b1220',
        secondary: isDark ? '#94a3b8' : '#64748b',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: 'transparent' },
          '::-webkit-scrollbar': { width: 10, height: 10 },
          '::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            background: isDark ? alpha('#ffffff', 0.12) : alpha('#1e293b', 0.18),
          },
          '::-webkit-scrollbar-thumb:hover': { background: alpha(BEACON, 0.6) },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: paperBg,
            backdropFilter: 'blur(12px)',
            border: `1px solid ${borderColor}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            backgroundImage: 'none',
            backgroundColor: paperBg,
            backdropFilter: 'blur(12px)',
            border: `1px solid ${borderColor}`,
            boxShadow: isDark
              ? '0 20px 50px -28px rgba(0,0,0,0.8)'
              : '0 16px 40px -24px rgba(15,23,42,0.22)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, textTransform: 'none', fontWeight: 700 },
          containedPrimary: {
            background: `linear-gradient(120deg, ${BEACON_LIGHT} 0%, ${BEACON} 60%, ${BEACON_DARK} 100%)`,
            color: INK,
            boxShadow: '0 10px 26px -10px rgba(242,162,13,0.6)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? alpha('#0b1220', 0.7) : alpha('#ffffff', 0.75),
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${borderColor}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? alpha('#0b1220', 0.72) : alpha('#ffffff', 0.82),
            backdropFilter: 'blur(12px)',
            border: 'none',
            borderLeft: `1px solid ${borderColor}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '&.Mui-selected': {
              backgroundColor: alpha(BEACON, 0.16),
              '&:hover': { backgroundColor: alpha(BEACON, 0.24) },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 700, borderRadius: 999 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: isDark ? alpha('#ffffff', 0.04) : alpha('#ffffff', 0.7),
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontFamily: 'Vazirmatn, system-ui, sans-serif', fontWeight: 600 },
        },
      },
    },
  })
}

export default createAppTheme('dark')

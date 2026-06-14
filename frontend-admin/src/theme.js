import { createTheme, alpha } from '@mui/material/styles'

const BRAND = '#6366f1' // indigo-500 (aurora anchor)
const BRAND_DARK = '#4f46e5'
const ACCENT = '#06b6d4' // cyan-500

/**
 * Build the Aurora-Glass MUI theme for the given mode ('light' | 'dark').
 * Surfaces are translucent + blurred so the aurora background shows through.
 */
export function createAppTheme(mode = 'dark') {
  const isDark = mode === 'dark'

  const paperBg = isDark ? alpha('#0f172a', 0.6) : alpha('#ffffff', 0.7)
  const borderColor = isDark ? alpha('#ffffff', 0.1) : alpha('#1e293b', 0.08)

  return createTheme({
    direction: 'rtl',
    typography: {
      fontFamily: 'Vazirmatn, system-ui, sans-serif',
      h4: { fontWeight: 900, letterSpacing: '-0.02em' },
      h5: { fontWeight: 900, letterSpacing: '-0.01em' },
      h6: { fontWeight: 800 },
      button: { fontWeight: 700 },
    },
    shape: { borderRadius: 16 },
    palette: {
      mode,
      primary: { main: BRAND, dark: BRAND_DARK },
      secondary: { main: '#10b981' },
      info: { main: ACCENT },
      warning: { main: '#f59e0b' },
      error: { main: '#f43f5e' },
      success: { main: '#10b981' },
      background: {
        default: isDark ? '#070b1a' : '#eef2ff',
        paper: isDark ? '#0f172a' : '#ffffff',
      },
      divider: borderColor,
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
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: paperBg,
            backdropFilter: 'blur(18px)',
            border: `1px solid ${borderColor}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 22,
            backgroundImage: 'none',
            backgroundColor: paperBg,
            backdropFilter: 'blur(18px)',
            border: `1px solid ${borderColor}`,
            boxShadow: isDark
              ? '0 18px 50px -18px rgba(0,0,0,0.7)'
              : '0 18px 50px -22px rgba(79,70,229,0.25)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 14, textTransform: 'none', fontWeight: 700 },
          containedPrimary: {
            background: `linear-gradient(135deg, ${BRAND} 0%, ${ACCENT} 120%)`,
            boxShadow: '0 10px 30px -10px rgba(99,102,241,0.6)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? alpha('#0b1020', 0.55) : alpha('#ffffff', 0.6),
            backdropFilter: 'blur(18px)',
            borderBottom: `1px solid ${borderColor}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? alpha('#0b1020', 0.55) : alpha('#ffffff', 0.65),
            backdropFilter: 'blur(18px)',
            border: 'none',
            borderLeft: `1px solid ${borderColor}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            '&.Mui-selected': {
              backgroundColor: alpha(BRAND, 0.16),
              '&:hover': { backgroundColor: alpha(BRAND, 0.22) },
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
            borderRadius: 14,
            backgroundColor: isDark ? alpha('#ffffff', 0.04) : alpha('#ffffff', 0.7),
          },
        },
      },
    },
  })
}

export default createAppTheme('dark')

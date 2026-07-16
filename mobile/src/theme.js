/**
 * "Civic Signal" design tokens — shared with the citizen + admin web apps.
 * Ink canvas at night, amber "beacon" = the signal/attention accent, emerald
 * "civic" = resolved/service, coral = urgent, sky = info. RTL-first, Vazirmatn.
 *
 * Key names are kept stable (brand / aurora / emerald / amber / rose) so every
 * screen keeps working; only the values changed. `onBrand` is the readable text
 * colour to place on a beacon-amber surface.
 */

export const colors = {
  // Beacon (amber) — the signature "signal" accent. `brand` for back-compat.
  brand: {
    50: '#fff8ea',
    100: '#fdecc4',
    200: '#fbdd97',
    300: '#f9c95a',
    400: '#f9b526',
    500: '#f2a20d',
    600: '#d67f04',
    700: '#b15c08',
    800: '#8f480e',
    900: '#763b0f',
    950: '#451e05',
  },
  // Civic (emerald) — resolved / service / success / live
  civic: {
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#0d9c6e',
    700: '#0f7a58',
  },
  // Sky — info / in-progress
  sky: {
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
  },
  // Coral — urgent / crisis
  coral: {
    300: '#fba3ae',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
  },
  // Legacy "aurora" keys remapped onto the new palette so old references still render.
  aurora: {
    violet: '#f9b526', // → beacon
    cyan: '#38bdf8', // → sky
    teal: '#34d399', // → civic
    fuchsia: '#fb7185', // → coral
    sky: '#38bdf8',
  },

  // Dark civic canvas
  ink: '#0b1220',
  ink2: '#101a2e',
  surface: 'rgba(255,255,255,0.05)',
  surfaceStrong: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',

  white: '#ffffff',
  onBrand: '#0b1220', // readable text on beacon-amber
  text: '#f1f5f9',
  textMuted: '#cbd5e1',
  textFaint: '#94a3b8',

  // Semantic aliases
  emerald: '#10b981',
  emeraldSoft: 'rgba(16,185,129,0.16)',
  amber: '#f2a20d',
  amberSoft: 'rgba(242,162,13,0.16)',
  rose: '#f43f5e',
  roseSoft: 'rgba(244,63,94,0.16)',
  slate: '#64748b',
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  '2xl': 30,
  pill: 999,
};

export const spacing = (n) => n * 4;

export const fonts = {
  light: 'Vazir_300',
  regular: 'Vazir_400',
  medium: 'Vazir_500',
  semibold: 'Vazir_600',
  bold: 'Vazir_700',
  extrabold: 'Vazir_800',
  black: 'Vazir_900',
};

export const shadow = {
  glow: {
    shadowColor: colors.brand[500],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 8,
  },
  emerald: {
    shadowColor: colors.civic[500],
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 10,
  },
};

// Default RTL text style helpers
export const rtlText = { writingDirection: 'rtl', textAlign: 'right' };

import { describe, it, expect } from 'vitest'
import defaultTheme, { createAppTheme } from './theme.js'

/**
 * The "Civic Signal" MUI theme. RTL is not cosmetic here — the whole dashboard
 * is Persian, and a theme that silently reverts to LTR mirrors every layout.
 */

describe('direction and typography', () => {
  it('is right-to-left', () => {
    expect(createAppTheme('dark').direction).toBe('rtl')
  })

  it('is right-to-left in light mode too', () => {
    expect(createAppTheme('light').direction).toBe('rtl')
  })

  it('uses Vazirmatn as the primary font', () => {
    expect(createAppTheme('dark').typography.fontFamily).toContain('Vazirmatn')
  })

  it('falls back to a system font stack', () => {
    expect(createAppTheme('dark').typography.fontFamily).toContain('sans-serif')
  })
})

describe('colour modes', () => {
  it('builds a dark theme', () => {
    expect(createAppTheme('dark').palette.mode).toBe('dark')
  })

  it('builds a light theme', () => {
    expect(createAppTheme('light').palette.mode).toBe('light')
  })

  it('defaults to dark when no mode is given', () => {
    expect(createAppTheme().palette.mode).toBe('dark')
  })

  it('renders an unknown mode with light surfaces rather than crashing', () => {
    // Anything that is not exactly 'dark' takes the light branch.
    expect(() => createAppTheme('sepia')).not.toThrow()
    expect(createAppTheme('sepia').palette.background.paper).toBe(
      createAppTheme('light').palette.background.paper,
    )
  })

  it('exports a ready-made dark theme as the default', () => {
    expect(defaultTheme.palette.mode).toBe('dark')
  })

  it('produces different surfaces per mode', () => {
    expect(createAppTheme('dark').palette.background.paper).not.toBe(
      createAppTheme('light').palette.background.paper,
    )
  })
})

describe('the shared Civic Signal palette', () => {
  it('uses beacon amber as the primary accent', () => {
    expect(createAppTheme('dark').palette.primary.main.toLowerCase()).toBe('#f2a20d')
  })

  it('keeps the accent identical across modes, so branding does not shift', () => {
    expect(createAppTheme('dark').palette.primary.main).toBe(
      createAppTheme('light').palette.primary.main,
    )
  })

  it('exposes success, error and info roles', () => {
    const palette = createAppTheme('dark').palette
    expect(palette.success.main).toBeTruthy()
    expect(palette.error.main).toBeTruthy()
    expect(palette.info.main).toBeTruthy()
  })

  it('matches the citizen app status colours for resolved and in-progress', () => {
    // RESOLVED is emerald #10b981 and IN_PROGRESS beacon #f2a20d in every client.
    const palette = createAppTheme('dark').palette
    expect(palette.success.main.toLowerCase()).toBe('#10b981')
    expect(palette.primary.main.toLowerCase()).toBe('#f2a20d')
  })
})

describe('theme stability', () => {
  it('builds a fresh object each call, so mutations cannot leak', () => {
    expect(createAppTheme('dark')).not.toBe(createAppTheme('dark'))
  })

  it('is deterministic for the same mode', () => {
    expect(createAppTheme('dark').palette.primary.main).toBe(
      createAppTheme('dark').palette.primary.main,
    )
  })
})

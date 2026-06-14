import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const ColorModeContext = createContext({ mode: 'dark', toggle: () => {} })

export function useColorMode() {
  return useContext(ColorModeContext)
}

export function getInitialMode() {
  try {
    const saved = localStorage.getItem('admin-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function useProvideColorMode() {
  const [mode, setMode] = useState(getInitialMode)

  useEffect(() => {
    try {
      localStorage.setItem('admin-theme', mode)
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  return useMemo(
    () => ({ mode, toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')) }),
    [mode],
  )
}

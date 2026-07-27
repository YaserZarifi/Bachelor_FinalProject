import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { getInitialMode, useProvideColorMode } from './ColorModeContext.jsx'

describe('getInitialMode', () => {
  it('defaults to dark for a first-time visitor', () => {
    expect(getInitialMode()).toBe('dark')
  })

  it('restores a saved light preference', () => {
    localStorage.setItem('admin-theme', 'light')
    expect(getInitialMode()).toBe('light')
  })

  it('restores a saved dark preference', () => {
    localStorage.setItem('admin-theme', 'dark')
    expect(getInitialMode()).toBe('dark')
  })

  it('ignores a corrupt stored value', () => {
    localStorage.setItem('admin-theme', 'neon')
    expect(getInitialMode()).toBe('dark')
  })
})

describe('useProvideColorMode', () => {
  it('starts from the stored preference', () => {
    localStorage.setItem('admin-theme', 'light')
    const { result } = renderHook(() => useProvideColorMode())
    expect(result.current.mode).toBe('light')
  })

  it('toggles from dark to light', () => {
    const { result } = renderHook(() => useProvideColorMode())
    act(() => result.current.toggle())
    expect(result.current.mode).toBe('light')
  })

  it('toggles back to dark', () => {
    const { result } = renderHook(() => useProvideColorMode())
    act(() => result.current.toggle())
    act(() => result.current.toggle())
    expect(result.current.mode).toBe('dark')
  })

  it('persists the choice so it survives a reload', () => {
    const { result } = renderHook(() => useProvideColorMode())
    act(() => result.current.toggle())
    expect(localStorage.getItem('admin-theme')).toBe('light')
  })

  it('mirrors the mode onto the document element for Tailwind-style styling', () => {
    const { result } = renderHook(() => useProvideColorMode())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    act(() => result.current.toggle())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('keeps the context value referentially stable between renders', () => {
    const { result, rerender } = renderHook(() => useProvideColorMode())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})

import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { loginTokens, logoutClient } from '../api/client.js'
import { useAuth } from './useAuth.js'

function fakeJwt(payload) {
  const b64 = (o) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`
}

describe('useAuth', () => {
  it('starts signed out when no token is stored', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.authed).toBe(false)
    expect(result.current.username).toBeNull()
  })

  it('starts signed in when a token is already stored', () => {
    localStorage.setItem('access_token', fakeJwt({ username: 'ali' }))
    const { result } = renderHook(() => useAuth())
    expect(result.current.authed).toBe(true)
    expect(result.current.username).toBe('ali')
  })

  it('reacts to a login happening elsewhere in the app', () => {
    const { result } = renderHook(() => useAuth())
    act(() => loginTokens(fakeJwt({ username: 'sara' })))
    expect(result.current.authed).toBe(true)
    expect(result.current.username).toBe('sara')
  })

  it('reacts to a logout', () => {
    localStorage.setItem('access_token', fakeJwt({ username: 'ali' }))
    const { result } = renderHook(() => useAuth())
    act(() => logoutClient())
    expect(result.current.authed).toBe(false)
  })

  it('reacts to a sign-in performed in another browser tab', () => {
    const { result } = renderHook(() => useAuth())
    localStorage.setItem('access_token', fakeJwt({ username: 'tab2' }))
    act(() => window.dispatchEvent(new Event('storage')))
    expect(result.current.username).toBe('tab2')
  })

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => useAuth())
    unmount()
    // Must not throw "update on unmounted component".
    expect(() => act(() => loginTokens(fakeJwt({ username: 'x' })))).not.toThrow()
    expect(result.current.authed).toBe(false)
  })
})

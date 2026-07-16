import { useEffect, useState } from 'react'
import { isAuthenticated, currentUsername } from '../api/client.js'

/**
 * Reactive auth snapshot. Updates on login/logout (via the `auth-changed`
 * event) and on cross-tab `storage` changes.
 */
export function useAuth() {
  const [state, setState] = useState(() => ({
    authed: isAuthenticated(),
    username: currentUsername(),
  }))

  useEffect(() => {
    const sync = () =>
      setState({ authed: isAuthenticated(), username: currentUsername() })
    window.addEventListener('auth-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('auth-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return state
}

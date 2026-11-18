import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi, type LoginPayload } from '../api/auth'
import { parseUser, type SessionUser } from '../lib/jwt'
import { tokenStore } from '../lib/storage'

interface AuthValue {
  user: SessionUser | null
  isAdmin: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: string[]) => boolean
  can: (perm: string) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)
const lower = (s: string) => s.toLowerCase().replace(/^perm:/, '')

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<SessionUser | null>(() => {
    const token = tokenStore.access
    return token ? parseUser(token) : null
  })

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await authApi.login(payload)
    if (res.status === false || !res.accessToken) throw new Error(res.message ?? 'Sign-in failed.')
    tokenStore.set(res.accessToken, res.refreshToken)
    setUser(parseUser(res.accessToken))
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* Clear the local session even if the server request fails. */
    }
    tokenStore.clear()
    queryClient.clear()
    setUser(null)
  }, [queryClient])

  const value = useMemo<AuthValue>(() => {
    const roles = (user?.roles ?? []).map(lower)
    const perms = (user?.perms ?? []).map(lower)
    const isAdmin = roles.includes('admin')
    return {
      user,
      isAdmin,
      login,
      logout,
      hasRole: (...wanted) => wanted.some((r) => roles.includes(lower(r))),
      can: (perm) => isAdmin || perms.includes(lower(perm)),
    }
  }, [user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

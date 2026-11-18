import { jwtDecode } from 'jwt-decode'

const ROLE_URI = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
const NAME_URI = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
const ID_URI = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'

export interface SessionUser {
  id?: string
  name: string
  email?: string
  roles: string[]
  perms: string[]
}

const toArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : [])

export function parseUser(token: string): SessionUser | null {
  try {
    const c = jwtDecode<Record<string, unknown>>(token)
    const sub = c.sub ? String(c.sub) : undefined
    const email = c.email ? String(c.email) : sub?.includes('@') ? sub : undefined
    const name = String(c.name ?? c[NAME_URI] ?? c.unique_name ?? email ?? sub ?? 'User')
    return {
      id: String(c.nameid ?? c[ID_URI] ?? sub ?? ''),
      name,
      email,
      roles: toArray(c.role ?? c[ROLE_URI]),
      perms: toArray(c.perm),
    }
  } catch {
    return null
  }
}

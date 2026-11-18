import { authHttp } from '../lib/http'

export interface UserDirectoryEntry {
  id: string
  email?: string | null
  roles?: string[]
}

function isUserDirectoryEntry(value: unknown): value is UserDirectoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const user = value as Record<string, unknown>
  return typeof user.id === 'string'
    && (user.email == null || typeof user.email === 'string')
    && (user.roles == null || (Array.isArray(user.roles) && user.roles.every((role) => typeof role === 'string')))
}

export const usersApi = {
  list: async (): Promise<UserDirectoryEntry[]> => {
    const { data } = await authHttp.get<unknown>('/api/users')
    if (!Array.isArray(data) || !data.every(isUserDirectoryEntry)) {
      throw new Error('The user list response has an unexpected format.')
    }
    return data
  },
}

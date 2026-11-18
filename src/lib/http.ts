import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { tokenStore } from './storage'

// In development, use the Vite proxy (/auth-api, /ticket-api). In production, use the real URL from .env.
export const AUTH_URL: string = import.meta.env.VITE_AUTH_API_URL ?? '/auth-api'
export const TICKET_URL: string = import.meta.env.VITE_TICKET_API_URL ?? '/ticket-api'
export const DEVICE_URL: string = import.meta.env.VITE_DEVICE_API_URL ?? '/device-api'

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.refresh
  if (!refreshToken) return null
  try {
    const { data } = await axios.post(`${AUTH_URL}/api/Account/refresh-token`, { refreshToken })
    const access: string | undefined = data?.accessToken ?? data?.token
    if (!access) return null
    tokenStore.set(access, data?.refreshToken ?? refreshToken)
    return access
  } catch {
    return null
  }
}

function createClient(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } })

  instance.interceptors.request.use((config) => {
    const token = tokenStore.access
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    return config
  })

  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const original = error.config as RetryConfig | undefined
      const isLogin = original?.url?.includes('/Account/login')
      if (error.response?.status === 401 && original && !original._retry && !isLogin) {
        original._retry = true
        refreshing ??= refreshAccessToken().finally(() => {
          refreshing = null
        })
        const token = await refreshing
        if (token) {
          original.headers.set('Authorization', `Bearer ${token}`)
          return instance(original)
        }
        tokenStore.clear()
        window.location.assign('/login')
      }
      return Promise.reject(error)
    },
  )
  return instance
}

export const authHttp = createClient(AUTH_URL)
export const ticketHttp = createClient(TICKET_URL)
export const deviceHttp = createClient(DEVICE_URL)

export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data
    if (typeof d === 'string' && d.trim()) return d
    if (d?.message) return String(d.message)
    if (d?.title) return String(d.title)
    if (d?.errors) {
      const first = Object.values(d.errors).flat()[0]
      if (first) return String(first)
    }
    if (err.response?.status === 403) return 'You do not have permission to perform this action.'
    if (err.response?.status === 401) return 'Your session has expired. Please sign in again.'
    if (!err.response) return 'Could not connect to the server. Check your network connection or CORS settings.'
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

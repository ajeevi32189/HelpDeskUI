import axios from 'axios'
import { AUTH_URL, authHttp } from '../lib/http'

const publicAuthHttp = axios.create({ baseURL: AUTH_URL, timeout: 15_000 })

export interface CaptchaData {
  captchaKey: string
  captchaValue: string
}

export interface LoginPayload {
  username: string
  password: string
  captchaKey: string
  captchaValue: string
}

export interface LoginResult {
  status?: boolean
  message?: string
  accessToken: string
  accessTokenExpiration?: string
  refreshToken?: string
  refreshTokenExpiration?: string
}

let captchaRequest: Promise<CaptchaData> | null = null

export const authApi = {
  captcha: async () => {
    if (!captchaRequest) {
      captchaRequest = publicAuthHttp
        .get<CaptchaData>('/api/captcha/generate')
        .then(({ data }) => {
          if (
            typeof data?.captchaKey !== 'string' ||
            !data.captchaKey.trim() ||
            typeof data?.captchaValue !== 'string' ||
            !data.captchaValue.trim()
          ) {
            throw new Error('User Management returned an invalid CAPTCHA response.')
          }
          return data
        })
        .finally(() => {
          captchaRequest = null
        })
    }
    return captchaRequest
  },
  login: async (payload: LoginPayload) => (await authHttp.post<LoginResult>('/api/Account/login', payload)).data,
  logout: async () => {
    await authHttp.post('/api/Account/logout')
  },
}

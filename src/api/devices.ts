import { deviceHttp } from '../lib/http'

export interface DeviceDetailDto {
  id: string
  deviceMasterId?: string
  shortName?: string | null
  longName?: string | null
  tagNumber?: string | null
  serialNumber?: string | null
}

function isDeviceDetail(value: unknown): value is DeviceDetailDto {
  if (typeof value !== 'object' || value === null) return false
  const device = value as Record<string, unknown>
  return typeof device.id === 'string'
    && (device.shortName == null || typeof device.shortName === 'string')
    && (device.longName == null || typeof device.longName === 'string')
    && (device.tagNumber == null || typeof device.tagNumber === 'string')
    && (device.serialNumber == null || typeof device.serialNumber === 'string')
}

export const devicesApi = {
  list: async (): Promise<DeviceDetailDto[]> => {
    const { data } = await deviceHttp.get<unknown>('/api/DeviceDetail/get-all-devicedetail', {
      params: { IsPaginated: false },
    })
    const body = Array.isArray(data) ? data : (data as Record<string, unknown> | null)?.data
    if (!Array.isArray(body) || !body.every(isDeviceDetail)) {
      throw new Error('The device list response has an unexpected format.')
    }
    return body
  },
}

import { ticketHttp } from '../lib/http'

export type AdminResource = 'sla' | 'escalation' | 'emailTemplate' | 'workOrderTemplate'
export type AdminRecord = Record<string, unknown>

const resourcePaths: Record<AdminResource, string> = {
  sla: '/api/sla',
  escalation: '/api/escalation',
  emailTemplate: '/api/templates',
  workOrderTemplate: '/api/workordertemplates',
}

function isRecord(value: unknown): value is AdminRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordId(record: AdminRecord): string | number | null {
  const id = record.id ?? record.Id
  return typeof id === 'string' || typeof id === 'number' ? id : null
}

function unwrapRecord(data: unknown): AdminRecord {
  const record = isRecord(data) && isRecord(data.data) ? data.data : data
  if (!isRecord(record)) throw new Error('The server returned an unexpected record format.')
  return record
}

export const adminConfigApi = {
  list: async (resource: AdminResource): Promise<AdminRecord[]> => {
    const { data } = await ticketHttp.get<unknown>(resourcePaths[resource], {
      ...(resource === 'workOrderTemplate' ? { params: { activeOnly: false } } : {}),
    })
    const envelope = isRecord(data) && isRecord(data.data) ? data.data : data
    const rows = Array.isArray(data)
      ? data
      : isRecord(data) && Array.isArray(data.data)
        ? data.data
        : isRecord(envelope) && Array.isArray(envelope.items)
          ? envelope.items
          : isRecord(envelope) && Array.isArray(envelope.results)
            ? envelope.results
            : null
    if (!rows || !rows.every(isRecord)) throw new Error('The server returned an unexpected list format.')
    return rows
  },
  get: async (resource: AdminResource, id: string | number) =>
    unwrapRecord((await ticketHttp.get<unknown>(`${resourcePaths[resource]}/${id}`)).data),
  create: async (resource: AdminResource, payload: AdminRecord) =>
    (await ticketHttp.post(resourcePaths[resource], payload)).data,
  update: async (resource: AdminResource, id: string | number, payload: AdminRecord) =>
    (await ticketHttp.put(`${resourcePaths[resource]}/${id}`, payload)).data,
  remove: async (resource: AdminResource, id: string | number) =>
    (await ticketHttp.delete(`${resourcePaths[resource]}/${id}`)).data,
  sendEscalationTestEmail: async () => (await ticketHttp.get<unknown>('/api/escalation/test-email')).data,
}

export function getRecordId(record: AdminRecord): string | number | null {
  return recordId(record)
}

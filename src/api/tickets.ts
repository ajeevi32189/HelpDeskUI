import { ticketHttp } from '../lib/http'
import type { CreateTicketPayload, Paged, Ticket, TicketQuery } from '../types'

// The server may return the paged total under different property names, so check each supported name.
function normalizePaged<T>(raw: unknown, page: number, pageSize: number): Paged<T> {
  const obj = (Array.isArray(raw) ? {} : (raw ?? {})) as Record<string, unknown>
  const items = (Array.isArray(raw) ? raw : (obj.items ?? obj.data ?? obj.results ?? [])) as T[]
  const t = obj.totalCount ?? obj.total ?? obj.totalItems ?? obj.totalRecords ?? obj.count
  return { items, total: typeof t === 'number' ? t : null, page, pageSize }
}

// The body for assign / resolve / close is a single JSON string (for example, "user@x.com").
const jsonString = (value: string) => JSON.stringify(value)
const asJson = { headers: { 'Content-Type': 'application/json' } }

function isTicket(value: unknown): value is Ticket {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const ticket = value as Record<string, unknown>
  return typeof ticket.ticketId === 'number'
    && typeof ticket.ticketTitle === 'string'
    && typeof ticket.status === 'string'
}

function normalizeTicketResponse(value: unknown): Ticket {
  if (isTicket(value)) return value
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const wrappedTicket = (value as Record<string, unknown>).ticket
    if (isTicket(wrappedTicket)) return wrappedTicket
  }
  throw new Error('The ticket details response has an unexpected format.')
}

export interface TicketFromTemplatePayload {
  reporterId: string
  ticketType: string
  titleOverride?: string | null
  descriptionOverride?: string | null
  priorityOverride?: string | null
  slaIdOverride?: number | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
}

export const ticketsApi = {
  list: async (q: TicketQuery) => {
    const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v != null))
    const { data } = await ticketHttp.get('/api/tickets', { params })
    return normalizePaged<Ticket>(data, q.page ?? 1, q.pageSize ?? 25)
  },
  get: async (id: number) => {
    const { data } = await ticketHttp.get<unknown>(`/api/tickets/${id}`)
    return normalizeTicketResponse(data)
  },
  create: async (payload: CreateTicketPayload) => (await ticketHttp.post('/api/tickets', payload)).data,
  update: async (id: number, payload: CreateTicketPayload) => (await ticketHttp.put(`/api/tickets/${id}`, payload)).data,
  remove: async (id: number) => (await ticketHttp.delete(`/api/tickets/${id}`)).data,
  assign: async (id: number, assignee: string) =>
    (await ticketHttp.patch(`/api/tickets/${id}/assign`, jsonString(assignee), asJson)).data,
  resolve: async (id: number, resolution: string) =>
    (await ticketHttp.patch(`/api/tickets/${id}/resolve`, jsonString(resolution), asJson)).data,
  close: async (id: number, resolution: string) =>
    (await ticketHttp.patch(`/api/tickets/${id}/close`, jsonString(resolution), asJson)).data,
  approve: async (id: number, notes?: string) => (await ticketHttp.post(`/api/tickets/${id}/approve`, { notes })).data,
  reject: async (id: number, notes?: string) => (await ticketHttp.post(`/api/tickets/${id}/reject`, { notes })).data,
  assignments: async (id: number) => (await ticketHttp.get<unknown[]>(`/api/tickets/${id}/assignments`)).data,
  audit: async (id: number) => (await ticketHttp.get<unknown[]>(`/api/tickets/${id}/audit`)).data,
  attachments: async (id: number) => {
    const { data } = await ticketHttp.get<unknown>(`/api/tickets/${id}/attachments`)
    const rows = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).data)
        ? (data as { data: unknown[] }).data
        : null
    if (!rows || !rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) {
      throw new Error('The attachment list response has an unexpected format.')
    }

    return rows as Record<string, unknown>[]
  },
  uploadAttachment: async (id: number, file: File, description: string) => {
    const body = new FormData()
    body.append('file', file)
    body.append('description', description)
    return (await ticketHttp.post(`/api/tickets/${id}/attachments`, body)).data
  },
  downloadAttachment: async (ticketId: number, attachmentId: string | number) =>
    ticketHttp.get<Blob>(`/api/tickets/${ticketId}/attachments/${attachmentId}/download`, { responseType: 'blob' }),
}

export const workOrderTemplatesApi = {
  createTicket: async (templateId: string | number, payload: TicketFromTemplatePayload) =>
    (await ticketHttp.post(`/api/workordertemplates/${templateId}/create-ticket`, payload)).data,
}

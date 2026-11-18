export interface Ticket {
  ticketId: number
  ticketTitle: string
  description?: string | null
  attachmentCount?: number
  category?: string | null
  subCategory?: string | null
  reporterId?: string | null
  severity?: string | null
  priority?: string | null
  status: string
  incidentOn?: string | null
  incidentLoggedOn?: string | null
  updatedAt?: string | null
  resolvedAt?: string | null
  closedAt?: string | null
  assignedToId?: string | null
  resolution?: string | null
  estimatedResolutionTime?: string | null
  actualElapsedMinutes?: number
  slaBreached?: boolean
  latitude?: number | null
  longitude?: number | null
  exactLocation?: string | null
  landmark?: string | null
  tagsJson?: string | null
  customFieldsJson?: string | null
  ticketType?: string | null
  deviceId?: string | null
  companyAssignedDevice?: string | null
  projectName?: string | null
  slaId?: number | null
  approvalStatus?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
  alertId?: string | null
  ticketSource?: string | null
  workOrderTemplateId?: number | null
  incidentLoggedBy?: string | null
}

export interface Paged<T> {
  items: T[]
  total: number | null
  page: number
  pageSize: number
}

export interface TicketQuery {
  status?: string
  priority?: string
  severity?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateTicketPayload {
  title: string
  description: string
  reporterId: string
  slaId: number
  category?: string | null
  subCategory?: string | null
  severity?: string | null
  priority?: string | null
  latitude?: number | null
  longitude?: number | null
  landmark?: string | null
  ticketType?: string | null
  deviceId?: string | null
  projectName?: string | null
  alertId?: string | null
  ticketSource?: string | null
  workOrderTemplateId?: number | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
}

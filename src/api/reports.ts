import { ticketHttp } from '../lib/http'

export interface WorkOrdersReport {
  from: string
  to: string
  totalWorkOrdersAndChanges: number
  pending: number
  approved: number
  rejected: number
  breakdown: Record<string, unknown>[]
}

export interface SlaComplianceRow {
  severity: string
  targetMinutes: number
  totalTickets: number
  closedInPeriod: number
  withinTarget: number
  breached: number
  compliancePercent: number | null
  avgResolutionMinutes: number | null
  stillOpenOverdue: number
}

export interface SlaComplianceReport {
  from: string
  to: string
  bySeverity: SlaComplianceRow[]
  totalTickets: number
  totalClosedInPeriod: number
  totalBreached: number
  overallCompliancePercent: number | null
}

function dateTimeBounds(from: string, to: string) {
  return {
    from: from ? `${from}T00:00:00` : undefined,
    to: to ? `${to}T23:59:59.999` : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWorkOrdersReport(value: unknown): WorkOrdersReport {
  if (
    !isRecord(value) ||
    typeof value.from !== 'string' ||
    typeof value.to !== 'string' ||
    typeof value.totalWorkOrdersAndChanges !== 'number' ||
    typeof value.pending !== 'number' ||
    typeof value.approved !== 'number' ||
    typeof value.rejected !== 'number' ||
    !Array.isArray(value.breakdown) ||
    !value.breakdown.every(isRecord)
  ) {
    throw new Error('The Work Orders report returned an unexpected response format.')
  }

  return {
    from: value.from,
    to: value.to,
    totalWorkOrdersAndChanges: value.totalWorkOrdersAndChanges,
    pending: value.pending,
    approved: value.approved,
    rejected: value.rejected,
    breakdown: value.breakdown,
  }
}

function parseSlaComplianceReport(value: unknown): SlaComplianceReport {
  if (
    !isRecord(value) ||
    typeof value.from !== 'string' ||
    typeof value.to !== 'string' ||
    !Array.isArray(value.bySeverity) ||
    typeof value.totalTickets !== 'number' ||
    typeof value.totalClosedInPeriod !== 'number' ||
    typeof value.totalBreached !== 'number' ||
    (typeof value.overallCompliancePercent !== 'number' && value.overallCompliancePercent !== null)
  ) {
    throw new Error('The SLA Compliance report returned an unexpected response format.')
  }

  const bySeverity = value.bySeverity.map((row): SlaComplianceRow => {
    if (
      !isRecord(row) ||
      typeof row.severity !== 'string' ||
      typeof row.targetMinutes !== 'number' ||
      typeof row.totalTickets !== 'number' ||
      typeof row.closedInPeriod !== 'number' ||
      typeof row.withinTarget !== 'number' ||
      typeof row.breached !== 'number' ||
      (typeof row.compliancePercent !== 'number' && row.compliancePercent !== null) ||
      (typeof row.avgResolutionMinutes !== 'number' && row.avgResolutionMinutes !== null) ||
      typeof row.stillOpenOverdue !== 'number'
    ) {
      throw new Error('The SLA Compliance report returned an unexpected severity record.')
    }

    return {
      severity: row.severity,
      targetMinutes: row.targetMinutes,
      totalTickets: row.totalTickets,
      closedInPeriod: row.closedInPeriod,
      withinTarget: row.withinTarget,
      breached: row.breached,
      compliancePercent: row.compliancePercent,
      avgResolutionMinutes: row.avgResolutionMinutes,
      stillOpenOverdue: row.stillOpenOverdue,
    }
  })

  return {
    from: value.from,
    to: value.to,
    bySeverity,
    totalTickets: value.totalTickets,
    totalClosedInPeriod: value.totalClosedInPeriod,
    totalBreached: value.totalBreached,
    overallCompliancePercent: value.overallCompliancePercent,
  }
}

export const reportsApi = {
  slaCompliance: async (from: string, to: string) => {
    const { data } = await ticketHttp.get<unknown>('/api/reports/sla-compliance', {
      params: dateTimeBounds(from, to),
    })
    return parseSlaComplianceReport(data)
  },
  workOrders: async (from: string, to: string) => {
    const { data } = await ticketHttp.get<unknown>('/api/reports/workorders', {
      params: dateTimeBounds(from, to),
    })
    return parseWorkOrdersReport(data)
  },
  exportSlaCompliance: async (from: string, to: string) =>
    ticketHttp.get<Blob>('/api/reports/sla-compliance/export', {
      params: dateTimeBounds(from, to),
      responseType: 'blob',
    }),
}

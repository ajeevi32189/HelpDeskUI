import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Headset,
  RefreshCw,
  Ticket as TicketIcon,
  TicketCheck,
  TimerReset,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { reportsApi } from '../api/reports'
import { ticketsApi } from '../api/tickets'
import { LevelBadge, StatusBadge } from '../components/Badges'
import { Button, Card, Input, Select, cx } from '../components/ui'
import { fmtDate } from '../lib/format'
import { getErrorMessage } from '../lib/http'
import type { Ticket } from '../types'

type ReportTab = 'summary' | 'sla' | 'workorders' | 'agents' | 'resolution' | 'categories'
type ReportActivity = {
  id: string
  name: string
  createdAt: string
  format: 'CSV' | 'Excel'
  records: number
}

const reportTabs: { id: ReportTab; label: string }[] = [
  { id: 'summary', label: 'Ticket Summary' },
  { id: 'sla', label: 'SLA Compliance' },
  { id: 'workorders', label: 'Work Orders' },
  { id: 'agents', label: 'Agent Performance' },
  { id: 'resolution', label: 'Resolution Time' },
  { id: 'categories', label: 'Category Breakdown' },
]

const toCsv = (value: unknown) =>
  `"${String(value ?? '').replaceAll('"', '""')}"`

const dateOnly = (value?: string | null) =>
  value ? value.slice(0, 10) : ''

const isDone = (ticket: Ticket) =>
  ['resolved', 'closed'].includes((ticket.status ?? '').trim().toLowerCase())

function parseTicketDate(value?: string | null) {
  if (!value) return null
  const timestamp = Date.parse(value.replace(/(\.\d{3})\d+/, '$1'))
  return Number.isFinite(timestamp) ? timestamp : null
}

function getResolutionDate(ticket: Ticket) {
  for (const value of [ticket.resolvedAt, ticket.closedAt]) {
    const timestamp = parseTicketDate(value)
    if (timestamp !== null) return timestamp
  }
  return null
}

function hasResolvedStatusAndTimestamp(ticket: Ticket) {
  return isDone(ticket) && getResolutionDate(ticket) !== null
}

function getResolutionMinutes(ticket: Ticket) {
  const resolvedAt = getResolutionDate(ticket)
  if (resolvedAt === null) return null

  if (
    typeof ticket.actualElapsedMinutes === 'number' &&
    Number.isFinite(ticket.actualElapsedMinutes) &&
    ticket.actualElapsedMinutes >= 0
  ) {
    return ticket.actualElapsedMinutes
  }

  const createdTime =
    parseTicketDate(ticket.incidentLoggedOn) ??
    parseTicketDate(ticket.incidentOn)
  if (createdTime === null || resolvedAt < createdTime) return null

  return (resolvedAt - createdTime) / 60_000
}

const isUnassigned = (ticket: Ticket) => !ticket.assignedToId?.trim()

const typeKey = (ticket: Ticket) =>
  (ticket.ticketType ?? '').toLowerCase().replace(/[^a-z]/g, '')

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function agentInitials(value: string) {
  const label = value.includes('@') ? value.split('@')[0] : value
  const parts = label.split(/[ ._-]+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatMinutes(value: number) {
  const minutes = Math.round(value)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatDateParts(value?: string | null) {
  const formatted = fmtDate(value)
  const separator = formatted.lastIndexOf(', ')
  return separator < 0
    ? [formatted, ''] as const
    : [formatted.slice(0, separator), formatted.slice(separator + 2)] as const
}

export default function ReportsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<ReportTab>('summary')
  const [errorText, setErrorText] = useState('')
  const [exportingSla, setExportingSla] = useState(false)
  const [reportActivity, setReportActivity] = useState<ReportActivity[]>([])
  const [activityPage, setActivityPage] = useState(1)
  const activityPageSize = 5

  const query = useQuery({
    queryKey: ['reports-tickets'],
    queryFn: () => ticketsApi.list({ page: 1, pageSize: 100 }),
    placeholderData: keepPreviousData,
  })

  const slaComplianceQuery = useQuery({
    queryKey: ['reports-sla-compliance', from, to],
    queryFn: () => reportsApi.slaCompliance(from, to),
    enabled: activeTab === 'summary' || activeTab === 'sla',
    placeholderData: keepPreviousData,
  })

  const workOrdersQuery = useQuery({
    queryKey: ['reports-workorders', from, to],
    queryFn: () => reportsApi.workOrders(from, to),
    enabled: activeTab === 'workorders',
    placeholderData: keepPreviousData,
  })

  const filtered = useMemo(
    () =>
      (query.data?.items ?? []).filter((ticket) => {
        const created = dateOnly(
          ticket.incidentLoggedOn ?? ticket.incidentOn,
        )

        if (from && created && created < from) return false
        if (to && created && created > to) return false

        if (
          kind === 'work-order' &&
          !['workorder', 'change'].some((key) => typeKey(ticket).includes(key))
        ) {
          return false
        }

        if (
          kind === 'incident' &&
          ['workorder', 'changerequest'].includes(typeKey(ticket))
        ) {
          return false
        }

        if (
          status !== 'all' &&
          (ticket.status ?? '').toLowerCase() !== status.toLowerCase()
        ) {
          return false
        }

        if (
          priority !== 'all' &&
          (ticket.priority ?? '').toLowerCase() !== priority.toLowerCase()
        ) {
          return false
        }

        const term = search.trim().toLowerCase()

        if (
          term &&
          ![
            ticket.ticketTitle,
            ticket.ticketId,
            ticket.ticketType,
            ticket.status,
            ticket.priority,
          ].some((value) =>
            String(value ?? '').toLowerCase().includes(term),
          )
        ) {
          return false
        }

        return true
      }),
    [query.data?.items, from, to, kind, status, priority, search],
  )

  const metrics = useMemo(() => {
    const completed = filtered.filter(isDone)
    const breached = filtered.filter((ticket) => ticket.slaBreached).length

    const resolvedWithTime = completed.filter(
      (ticket) =>
        typeof ticket.actualElapsedMinutes === 'number' &&
        ticket.actualElapsedMinutes >= 0,
    )

    const averageResolution = resolvedWithTime.length
      ? Math.round(
          resolvedWithTime.reduce(
            (sum, ticket) => sum + (ticket.actualElapsedMinutes ?? 0),
            0,
          ) / resolvedWithTime.length,
        )
      : null

    return {
      completed,
      breached,
      averageResolution,
    }
  }, [filtered])

  const volumeTrend = useMemo(() => {
    const dates = filtered
      .map((ticket) =>
        dateOnly(ticket.incidentLoggedOn ?? ticket.incidentOn),
      )
      .filter(Boolean)
      .sort()

    const end =
      to || dates.at(-1) || new Date().toISOString().slice(0, 10)

    const endDate = new Date(`${end}T12:00:00`)

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(endDate)
      date.setDate(date.getDate() - (6 - index))

      const key = date.toISOString().slice(0, 10)

      return {
        date: key,
        created: filtered.filter(
          (ticket) =>
            dateOnly(ticket.incidentLoggedOn ?? ticket.incidentOn) === key,
        ).length,
        completed: metrics.completed.filter(
          (ticket) =>
            dateOnly(ticket.resolvedAt ?? ticket.closedAt) === key,
        ).length,
      }
    })
  }, [filtered, metrics.completed, to])

  const agentPerformance = useMemo(() => {
    const grouped = new Map<
      string,
      {
        assigned: number
        completed: number
        breached: number
        resolutionMinutes: number
        timedCompleted: number
      }
    >()

    filtered.forEach((ticket) => {
      const name = ticket.assignedToId?.trim()
      if (!name) return

      const current = grouped.get(name) ?? {
        assigned: 0,
        completed: 0,
        breached: 0,
        resolutionMinutes: 0,
        timedCompleted: 0,
      }

      current.assigned += 1

      if (hasResolvedStatusAndTimestamp(ticket)) {
        current.completed += 1
        const resolutionMinutes = getResolutionMinutes(ticket)
        if (resolutionMinutes !== null) {
          current.resolutionMinutes += resolutionMinutes
          current.timedCompleted += 1
        }
      }
      if (ticket.slaBreached) current.breached += 1

      grouped.set(name, current)
    })

    return [...grouped.entries()]
      .map(([name, values]) => ({ name, ...values }))
      .sort(
        (a, b) =>
          b.completed - a.completed || b.assigned - a.assigned,
      )
      .slice(0, 5)
  }, [filtered])

  const unassignedTickets = useMemo(
    () =>
      filtered
        .filter(isUnassigned)
        .sort((a, b) => {
          const aCreated =
            parseTicketDate(a.incidentLoggedOn) ??
            parseTicketDate(a.incidentOn) ??
            0
          const bCreated =
            parseTicketDate(b.incidentLoggedOn) ??
            parseTicketDate(b.incidentOn) ??
            0
          return bCreated - aCreated
        }),
    [filtered],
  )

  const categoryBreakdown = useMemo(() => {
    const grouped = new Map<string, number>()

    filtered.forEach((ticket) => {
      const category = ticket.category?.trim() || 'Uncategorized'

      grouped.set(category, (grouped.get(category) ?? 0) + 1)
    })

    return [...grouped.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [filtered])

  const exportCsv = () => {
    if (!filtered.length) {
      setErrorText('There are no tickets in this report to export.')
      return
    }

    setErrorText('')

    const headers = [
      'Ticket ID',
      'Title',
      'Type',
      'Status',
      'Priority',
      'Severity',
      'Assigned to',
      'SLA breached',
      'Created',
      'Resolved',
      'Source',
    ]

    const rows = filtered.map((ticket) => [
      ticket.ticketId,
      ticket.ticketTitle,
      ticket.ticketType,
      ticket.status,
      ticket.priority,
      ticket.severity,
      ticket.assignedToId,
      ticket.slaBreached ? 'Yes' : 'No',
      ticket.incidentLoggedOn ?? ticket.incidentOn,
      ticket.resolvedAt,
      ticket.ticketSource,
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map(toCsv).join(','))
      .join('\r\n')

    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], {
        type: 'text/csv;charset=utf-8;',
      }),
    )

    const link = document.createElement('a')
    link.href = url
    link.download = `ajeevi-ticket-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setReportActivity((previous) => [
      {
        id: `${Date.now()}-${previous.length}`,
        name: 'Ticket summary report',
        createdAt: new Date().toISOString(),
        format: 'CSV',
        records: filtered.length,
      },
      ...previous,
    ])
    setActivityPage(1)
  }

  const exportSlaReport = async () => {
    setErrorText('')
    setExportingSla(true)

    try {
      const response = await reportsApi.exportSlaCompliance(from, to)

      const disposition = response.headers[
        'content-disposition'
      ] as string | undefined

      const filenameMatch = disposition?.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/i,
      )

      const filename = filenameMatch
        ? decodeURIComponent(filenameMatch[1].replaceAll('"', ''))
        : `sla-compliance-${new Date().toISOString().slice(0, 10)}.csv`

      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')

      link.href = url
      link.download = filename

      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setReportActivity((previous) => [
        {
          id: `${Date.now()}-${previous.length}`,
          name: 'SLA compliance report',
          createdAt: new Date().toISOString(),
          format: 'CSV',
          records: metrics.completed.length,
        },
        ...previous,
      ])
      setActivityPage(1)
    } catch (error) {
      setErrorText(getErrorMessage(error))
    } finally {
      setExportingSla(false)
    }
  }

  const pointsFor = (key: 'created' | 'completed') =>
    volumeTrend
      .map((point, index) => {
        const max = Math.max(
          1,
          ...volumeTrend.map((entry) =>
            Math.max(entry.created, entry.completed),
          ),
        )

        return `${24 + index * 96},${106 - (point[key] / max) * 82}`
      })
      .join(' ')

  const activityPageCount = Math.ceil(
    reportActivity.length / activityPageSize,
  )
  const visibleActivity = reportActivity.slice(
    (activityPage - 1) * activityPageSize,
    activityPage * activityPageSize,
  )
  const fetchedTicketCount = query.data?.items.length ?? 0
  const hasUnfetchedTickets =
    query.data?.total != null && query.data.total > fetchedTicketCount
  const workOrderBreakdown = workOrdersQuery.data?.breakdown ?? []
  const workOrderBreakdownColumns = [
    ...new Set(workOrderBreakdown.flatMap((row) => Object.keys(row))),
  ]

  return (
    <div className="page-enter min-w-0 space-y-4 sm:space-y-5">
      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium text-subtle">
            Dashboard <span className="px-1">/</span> Reports
          </p>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Reports &amp; Analytics
          </h1>

          <p className="mt-1 text-sm text-subtle">
            Track ticket trends, SLA performance, and service outcomes.
          </p>
          <p className="mt-1 text-xs text-subtle">
            {query.isLoading
              ? 'Loading tickets for analytics…'
              : query.isError
                ? 'Ticket analytics are unavailable.'
                : `Analytics are based on ${fetchedTicketCount} fetched tickets${
                    hasUnfetchedTickets
                      ? ` of ${query.data?.total} total`
                      : ''
                  }.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={exportingSla}
            onClick={exportSlaReport}
          >
            <Download className="size-4" />
            Export SLA
          </Button>

          <Button onClick={exportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-subtle">
              From date
            </span>
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-subtle">
              To date
            </span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-subtle">
              Report type
            </span>
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">All tickets</option>
              <option value="incident">Incidents</option>
              <option value="work-order">Work orders &amp; changes</option>
            </Select>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-subtle">
              Status
            </span>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option>Open</option>
              <option>Assigned</option>
              <option>Escalated</option>
              <option>Resolved</option>
              <option>Closed</option>
            </Select>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-subtle">
              Priority
            </span>
            <Select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="all">All priorities</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </Select>
          </label>

          <div className="flex min-w-0 gap-2">
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-subtle">
                Search tickets
              </span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, ID, type..."
              />
            </label>

            <Button
              variant="outline"
              className="mt-[22px] h-10 px-3"
              onClick={() => query.refetch()}
              title="Refresh report"
              aria-label="Refresh report"
            >
              <RefreshCw
                className={cx(
                  'size-4',
                  query.isFetching && 'animate-spin',
                )}
              />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            onClick={() => {
              setFrom('')
              setTo('')
              setKind('all')
              setStatus('all')
              setPriority('all')
              setSearch('')
              setErrorText('')
            }}
          >
            Reset filters
          </Button>
        </div>
      </Card>

      {/* Report tabs */}
      <div
        role="tablist"
        aria-label="Report views"
        className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1"
      >
        {reportTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm',
              activeTab === tab.id
                ? 'bg-brand text-white shadow-sm'
                : 'text-subtle hover:bg-soft hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorText && (
        <p role="alert" className="text-sm text-red-500">
          {errorText}
        </p>
      )}

      {query.isError && (
        <Card className="flex items-center gap-3 border-red-200 p-4 text-sm text-red-700 dark:border-red-500/30 dark:text-red-300">
          <CircleAlert className="size-5 shrink-0" />
          {getErrorMessage(query.error)}
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => query.refetch()}
          >
            Retry
          </Button>
        </Card>
      )}

      {query.isLoading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Card
                key={index}
                className="h-28 animate-pulse bg-soft"
              />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold">Top Agents</h2>
              <div className="mt-4 h-24 animate-pulse rounded-lg bg-soft" />
            </Card>
            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold">Unassigned Tickets</h2>
              <p className="mt-2 text-xs text-subtle">
                Loading ticket assignments…
              </p>
              <div className="mt-3 h-16 animate-pulse rounded-lg bg-soft" />
            </Card>
          </div>
        </>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Total Tickets',
                value: filtered.length,
                note:
                  query.data?.total != null &&
                  query.data.total > (query.data.items?.length ?? 0)
                    ? `Showing ${filtered.length} of ${query.data.total} matching tickets`
                    : 'Tickets matching current filters',
                icon: BarChart3,
                tone: 'text-brand bg-indigo-500/10',
              },
              {
                label: 'Resolved',
                value: metrics.completed.length,
                note: 'Resolved or closed tickets',
                icon: CheckCircle2,
                tone: 'text-emerald-600 bg-emerald-500/10',
              },
              {
                label: 'SLA Breached',
                value: metrics.breached,
                note: 'Tickets flagged as breached',
                icon: CircleAlert,
                tone: 'text-red-600 bg-red-500/10',
              },
              {
                label: 'Avg. Resolution Time',
                value:
                  metrics.averageResolution == null
                    ? '—'
                    : `${Math.floor(metrics.averageResolution / 60)}h ${
                        metrics.averageResolution % 60
                      }m`,
                note:
                  metrics.averageResolution == null
                    ? 'No resolution-time data available'
                    : 'Based on completed tickets',
                icon: Clock3,
                tone: 'text-amber-600 bg-amber-500/10',
              },
            ].map(({ label, value, note, icon: Icon, tone }) => (
              <Card key={label} className="min-w-0 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-subtle">
                      {label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                      {value}
                    </p>
                  </div>
                  <span
                    className={cx(
                      'grid size-9 shrink-0 place-items-center rounded-xl sm:size-10',
                      tone,
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-subtle">{note}</p>
              </Card>
            ))}
          </div>

          {/* Ticket Summary tab */}
          {activeTab === 'summary' && (
            <div className="grid min-w-0 gap-4 xl:grid-cols-[1.35fr_0.85fr]">
              <Card className="min-w-0 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Ticket Volume Trend</h2>
                    <p className="mt-1 text-xs text-subtle">
                      Created and completed tickets over the selected period
                    </p>
                  </div>
                  <span className="rounded-lg bg-indigo-500/10 p-2 text-brand">
                    <BarChart3 className="size-4" />
                  </span>
                </div>

                <div className="mt-4 overflow-hidden">
                  <svg
                    viewBox="0 0 624 132"
                    role="img"
                    aria-label="Seven day ticket volume trend"
                    className="h-40 w-full overflow-visible"
                  >
                    {[24, 65, 106].map((y) => (
                      <line
                        key={y}
                        x1="24"
                        x2="600"
                        y1={y}
                        y2={y}
                        className="stroke-line"
                        strokeDasharray="3 5"
                      />
                    ))}

                    <polyline
                      points={pointsFor('created')}
                      fill="none"
                      stroke="#ec2380"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <polyline
                      points={pointsFor('completed')}
                      fill="none"
                      stroke="#14b88a"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {volumeTrend.map((point, index) => (
                      <g key={point.date}>
                        <circle
                          cx={24 + index * 96}
                          cy={
                            106 -
                            (point.created /
                              Math.max(
                                1,
                                ...volumeTrend.map((entry) =>
                                  Math.max(entry.created, entry.completed),
                                ),
                              )) *
                              82
                          }
                          r="3.5"
                          fill="#ec2380"
                        />
                        <text
                          x={24 + index * 96}
                          y="128"
                          textAnchor="middle"
                          className="fill-subtle text-[10px]"
                        >
                          {dateLabel(point.date)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="mt-2 flex gap-5 text-xs text-subtle">
                  <span className="flex items-center gap-2">
                    <i className="size-2 rounded-full bg-indigo-500" />
                    Created
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="size-2 rounded-full bg-emerald-500" />
                    Resolved
                  </span>
                </div>
              </Card>

              <Card className="min-w-0 p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold">SLA Performance</h2>
                    <p className="mt-1 text-xs text-subtle">
                      Compliance across completed tickets
                    </p>
                  </div>
                  <TicketCheck className="size-5 text-emerald-600" />
                </div>

                <div className="flex flex-col items-center gap-5 py-5 sm:flex-row sm:justify-around">
                  <div
                    className="grid size-36 shrink-0 place-items-center rounded-full"
                    style={{
                      background: slaComplianceQuery.data?.overallCompliancePercent == null
                        ? '#e7eaf1'
                        : `conic-gradient(#10b981 ${slaComplianceQuery.data.overallCompliancePercent}%, #f43f5e ${slaComplianceQuery.data.overallCompliancePercent}% 100%)`,
                    }}
                  >
                    <div className="grid size-24 place-items-center rounded-full bg-surface text-center">
                      <span>
                        <strong className="block text-2xl">
                          {slaComplianceQuery.isLoading
                            ? '…'
                            : slaComplianceQuery.data?.overallCompliancePercent == null
                              ? '—'
                              : `${slaComplianceQuery.data.overallCompliancePercent}%`}
                        </strong>
                        <span className="text-[10px] text-subtle">
                          compliant
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <p className="flex items-center gap-2">
                      <i className="size-2 rounded-full bg-emerald-500" />
                      On time
                      <strong className="ml-auto pl-3">
                        {slaComplianceQuery.data?.bySeverity.reduce(
                          (sum, row) => sum + row.withinTarget,
                          0,
                        ) ?? '—'}
                      </strong>
                    </p>

                    <p className="flex items-center gap-2">
                      <i className="size-2 rounded-full bg-rose-500" />
                      Breached
                      <strong className="ml-auto pl-3">
                        {slaComplianceQuery.data?.totalBreached ?? '—'}
                      </strong>
                    </p>

                    {slaComplianceQuery.isError && (
                      <p className="max-w-40 text-xs text-red-600">
                        Could not load SLA report data.
                      </p>
                    )}
                    {!slaComplianceQuery.isLoading &&
                      !slaComplianceQuery.isError &&
                      slaComplianceQuery.data?.totalClosedInPeriod === 0 && (
                      <p className="max-w-40 text-xs text-subtle">
                        No tickets closed in this report period.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* SLA Compliance tab */}
          {activeTab === 'sla' && (
            <div className="space-y-4">
              {slaComplianceQuery.isError && (
                <Card className="flex items-center gap-3 border-red-200 p-4 text-sm text-red-700 dark:border-red-500/30 dark:text-red-300">
                  <CircleAlert className="size-5 shrink-0" />
                  {getErrorMessage(slaComplianceQuery.error)}
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={() => slaComplianceQuery.refetch()}
                  >
                    Retry
                  </Button>
                </Card>
              )}

              {slaComplianceQuery.isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Card key={index} className="h-28 animate-pulse bg-soft" />
                  ))}
                </div>
              ) : slaComplianceQuery.data ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-subtle">
                      Report period: {dateOnly(slaComplianceQuery.data.from)} – {dateOnly(slaComplianceQuery.data.to)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => slaComplianceQuery.refetch()}
                        title="Refresh SLA Compliance report"
                      >
                        <RefreshCw className={cx('size-4', slaComplianceQuery.isFetching && 'animate-spin')} />
                        Refresh
                      </Button>
                      <Button
                        variant="outline"
                        loading={exportingSla}
                        onClick={exportSlaReport}
                      >
                        <Download className="size-4" />
                        Download SLA report
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Total Tickets', value: slaComplianceQuery.data.totalTickets },
                      { label: 'Closed in Period', value: slaComplianceQuery.data.totalClosedInPeriod },
                      { label: 'Breached', value: slaComplianceQuery.data.totalBreached },
                      {
                        label: 'Overall Compliance',
                        value: slaComplianceQuery.data.overallCompliancePercent == null
                          ? '—'
                          : `${slaComplianceQuery.data.overallCompliancePercent}%`,
                      },
                    ].map(({ label, value }) => (
                      <Card key={label} className="p-4 sm:p-5">
                        <p className="text-xs font-medium text-subtle">{label}</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                      </Card>
                    ))}
                  </div>

                  <Card className="overflow-hidden">
                    <div className="border-b border-line p-4 sm:p-5">
                      <h2 className="font-semibold">SLA Compliance by Severity</h2>
                      <p className="mt-1 text-sm text-subtle">
                        Backend-calculated results for each severity level.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-left text-sm">
                        <thead className="bg-soft/70 text-[11px] uppercase tracking-wider text-subtle">
                          <tr>
                            {['Severity', 'Target (min)', 'Tickets', 'Closed', 'Within target', 'Breached', 'Compliance', 'Avg. resolution', 'Open overdue'].map((heading) => (
                              <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {slaComplianceQuery.data.bySeverity.map((row) => (
                            <tr key={row.severity}>
                              <td className="px-3 py-3"><LevelBadge level={row.severity} /></td>
                              <td className="px-3 py-3 tabular-nums">{row.targetMinutes.toLocaleString()}</td>
                              <td className="px-3 py-3 tabular-nums">{row.totalTickets}</td>
                              <td className="px-3 py-3 tabular-nums">{row.closedInPeriod}</td>
                              <td className="px-3 py-3 tabular-nums">{row.withinTarget}</td>
                              <td className="px-3 py-3 tabular-nums">{row.breached}</td>
                              <td className="px-3 py-3 tabular-nums">{row.compliancePercent == null ? '—' : `${row.compliancePercent}%`}</td>
                              <td className="px-3 py-3 tabular-nums">{row.avgResolutionMinutes == null ? '—' : formatMinutes(row.avgResolutionMinutes)}</td>
                              <td className="px-3 py-3 tabular-nums">{row.stillOpenOverdue}</td>
                            </tr>
                          ))}
                          {!slaComplianceQuery.data.bySeverity.length && (
                            <tr>
                              <td colSpan={9} className="px-4 py-10 text-center text-sm text-subtle">
                                No SLA severity breakdown was returned for this period.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          )}

          {activeTab === 'workorders' && (
            <div className="space-y-4">
              {workOrdersQuery.isError && (
                <Card className="flex items-center gap-3 border-red-200 p-4 text-sm text-red-700 dark:border-red-500/30 dark:text-red-300">
                  <CircleAlert className="size-5 shrink-0" />
                  {getErrorMessage(workOrdersQuery.error)}
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={() => workOrdersQuery.refetch()}
                  >
                    Retry
                  </Button>
                </Card>
              )}

              {workOrdersQuery.isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Card key={index} className="h-28 animate-pulse bg-soft" />
                  ))}
                </div>
              ) : workOrdersQuery.data ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-subtle">
                      Report period: {dateOnly(workOrdersQuery.data.from)} – {dateOnly(workOrdersQuery.data.to)}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => workOrdersQuery.refetch()}
                      title="Refresh Work Orders report"
                    >
                      <RefreshCw className={cx('size-4', workOrdersQuery.isFetching && 'animate-spin')} />
                      Refresh
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Work Orders & Changes', value: workOrdersQuery.data.totalWorkOrdersAndChanges },
                      { label: 'Pending', value: workOrdersQuery.data.pending },
                      { label: 'Approved', value: workOrdersQuery.data.approved },
                      { label: 'Rejected', value: workOrdersQuery.data.rejected },
                    ].map(({ label, value }) => (
                      <Card key={label} className="p-4 sm:p-5">
                        <p className="text-xs font-medium text-subtle">{label}</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                      </Card>
                    ))}
                  </div>

                  <Card className="overflow-hidden">
                    <div className="border-b border-line p-4 sm:p-5">
                      <h2 className="font-semibold">Work Order Breakdown</h2>
                      <p className="mt-1 text-sm text-subtle">
                        {workOrdersQuery.data.breakdown.length} breakdown records returned by the report service.
                      </p>
                    </div>
                    {workOrdersQuery.data.breakdown.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-soft/70 text-[11px] uppercase tracking-wider text-subtle">
                            <tr>
                              {workOrderBreakdownColumns.map((key) => (
                                <th key={key} className="px-4 py-3 font-semibold">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {workOrdersQuery.data.breakdown.map((row, index) => (
                              <tr key={index}>
                                {workOrderBreakdownColumns.map((key) => {
                                  const value = row[key]
                                  return (
                                    <td key={key} className="px-4 py-3">
                                      {value == null
                                        ? '—'
                                        : typeof value === 'object'
                                          ? JSON.stringify(value)
                                          : String(value)}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="px-6 py-10 text-center text-sm text-subtle">
                        No breakdown records were returned for this period.
                      </p>
                    )}
                  </Card>
                </>
              ) : null}
            </div>
          )}

          {/* Agent Performance tab */}
          {activeTab === 'agents' && (
            <Card className="overflow-hidden">
              <div className="border-b border-line p-4 sm:p-5">
                <h2 className="font-semibold">Agent Performance</h2>
                <p className="mt-1 text-sm text-subtle">
                  Ticket assignment and completion summary.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-soft/70 text-xs uppercase tracking-wide text-subtle">
                    <tr>
                      {[
                        'Agent',
                        'Assigned',
                        'Resolved / Closed',
                        'SLA Breached',
                        'Completion',
                      ].map((item) => (
                        <th key={item} className="px-4 py-3 font-semibold">
                          {item}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line">
                    {agentPerformance.map((agent) => (
                      <tr key={agent.name}>
                        <td className="px-4 py-3 font-medium">
                          {agent.name}
                        </td>
                        <td className="px-4 py-3">{agent.assigned}</td>
                        <td className="px-4 py-3">{agent.completed}</td>
                        <td className="px-4 py-3">{agent.breached}</td>
                        <td className="px-4 py-3">
                          {agent.assigned
                            ? `${Math.round(
                                (agent.completed / agent.assigned) * 100,
                              )}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}

                    {!agentPerformance.length && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-subtle"
                        >
                          No ticket assignment data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Resolution Time tab */}
          {activeTab === 'resolution' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-subtle">
                      Average resolution time
                    </p>
                    <p className="mt-2 text-3xl font-semibold">
                      {metrics.averageResolution == null
                        ? '—'
                        : `${Math.floor(
                            metrics.averageResolution / 60,
                          )}h ${metrics.averageResolution % 60}m`}
                    </p>
                  </div>
                  <Clock3 className="size-6 text-brand" />
                </div>
                <p className="mt-3 text-xs text-subtle">
                  Calculated from actual elapsed minutes on completed tickets
                  with recorded duration.
                </p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-subtle">Completed tickets</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {metrics.completed.length}
                    </p>
                  </div>
                  <TimerReset className="size-6 text-emerald-600" />
                </div>
                <p className="mt-3 text-xs text-subtle">
                  Resolved or closed tickets within the selected filters.
                </p>
              </Card>
            </div>
          )}

          {/* Category Breakdown tab */}
          {activeTab === 'categories' && (
            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold">Category Breakdown</h2>
              <p className="mt-1 text-sm text-subtle">
                Ticket volume grouped by category.
              </p>

              <div className="mt-5 space-y-4">
                {categoryBreakdown.map(({ category, count }) => (
                  <div key={category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{category}</span>
                      <span className="font-medium tabular-nums">
                        {count}
                      </span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{
                          width: `${Math.max(
                            4,
                            (count / Math.max(1, filtered.length)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}

                {!categoryBreakdown.length && (
                  <p className="py-8 text-center text-sm text-subtle">
                    No category data available.
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Summary activity table and side panels */}
          {activeTab === 'summary' && (
            <div className="grid min-w-0 gap-4 xl:grid-cols-[1.45fr_0.8fr]">
              <Card className="overflow-hidden">
                <div className="border-b border-line p-4 sm:p-5">
                  <h2 className="font-semibold">Recent Report Activity</h2>
                  <p className="mt-1 text-xs text-subtle">
                    Reports exported in this session
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-soft/70 text-[11px] uppercase tracking-wider text-subtle">
                      <tr>
                        {[
                          'Report name',
                          'Generated',
                          'Records',
                          'Format',
                          'Status',
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-3 py-3 font-semibold"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-line">
                        {visibleActivity.map((activity) => (
                          <tr key={activity.id} className="hover:bg-soft/50">
                            <td className="px-3 py-3 font-medium">
                              {activity.name}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-xs text-subtle">
                              {fmtDate(activity.createdAt)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {activity.records}
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
                                {activity.format === 'CSV' ? (
                                  <FileText className="size-4" />
                                ) : (
                                  <FileSpreadsheet className="size-4" />
                                )}
                                {activity.format}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                Completed
                              </span>
                            </td>
                          </tr>
                        ))}

                        {!reportActivity.length && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-10 text-center text-sm text-subtle"
                            >
                              No reports exported in this session yet. Use
                              “Export CSV” or “Export SLA” to create an entry.
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-subtle">
                  <span>
                    {reportActivity.length
                        ? `Showing ${(activityPage - 1) * activityPageSize + 1}–${Math.min(
                            activityPage * activityPageSize,
                            reportActivity.length,
                          )} of ${reportActivity.length}`
                        : 'Showing 0 reports'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="size-8 p-0"
                        aria-label="Previous activity page"
                        disabled={activityPage <= 1}
                        onClick={() =>
                          setActivityPage((page) => Math.max(1, page - 1))
                        }
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <span>
                        Page {reportActivity.length ? activityPage : 0} of{' '}
                        {activityPageCount}
                    </span>
                    <Button
                        variant="outline"
                        className="size-8 p-0"
                        aria-label="Next activity page"
                        disabled={activityPage >= activityPageCount}
                        onClick={() =>
                          setActivityPage((page) =>
                            Math.min(activityPageCount, page + 1),
                          )
                        }
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4">
                <Card className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold">Top Agents</h2>
                        <p className="mt-1 text-xs text-subtle">
                          Ranked by resolved tickets, then assigned tickets.
                        </p>
                    </div>
                    <CheckCircle2 className="size-5 text-brand" />
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[400px] text-left text-xs">
                      <thead className="border-b border-line bg-soft/50 text-[10px] font-semibold text-subtle">
                        <tr>
                          <th className="px-2 py-2">Agent</th>
                          <th className="px-2 py-2 text-right">Assigned</th>
                          <th className="px-2 py-2 text-right">Resolved</th>
                          <th className="px-2 py-2 text-right">
                            Avg. Resolution
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {!query.isLoading &&
                          !query.isError &&
                          agentPerformance.map((agent) => (
                            <tr key={agent.name} className="hover:bg-soft/40">
                              <td className="max-w-36 px-2 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand">
                                    {agentInitials(agent.name) || 'A'}
                                  </span>
                                  <span
                                    className="truncate font-medium"
                                    title={agent.name}
                                  >
                                    {agent.name}
                                  </span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                {agent.assigned}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                {agent.completed}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-subtle">
                                {agent.timedCompleted
                                  ? formatMinutes(
                                      agent.resolutionMinutes /
                                        agent.timedCompleted,
                                    )
                                  : '—'}
                              </td>
                            </tr>
                          ))}

                        {query.isLoading && (
                          <tr>
                            <td colSpan={4} className="px-2 py-6">
                              <div className="h-4 animate-pulse rounded bg-soft" />
                            </td>
                          </tr>
                        )}

                        {query.isError && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-2 py-6 text-center text-red-600"
                            >
                              Could not load agent data.
                            </td>
                          </tr>
                        )}

                        {!query.isLoading &&
                          !query.isError &&
                          !agentPerformance.length && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-2 py-8 text-center text-subtle"
                            >
                              No agent assignment data available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:p-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-brand">
                        <TicketIcon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-semibold">Unassigned Tickets</h2>
                        <p className="mt-0.5 text-xs text-subtle">
                          Latest unassigned tickets
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-medium text-brand">
                      <span className="grid size-4 place-items-center rounded-full bg-brand text-[9px] text-white">
                        {query.isLoading || query.isError
                          ? '—'
                          : unassignedTickets.length}
                      </span>
                      {query.isLoading
                        ? 'Loading'
                        : query.isError
                          ? 'Unavailable'
                          : 'unassigned in fetched results'}
                    </span>
                  </div>

                  {!query.isLoading &&
                    !query.isError &&
                    hasUnfetchedTickets && (
                      <p className="border-b border-line px-4 py-2 text-[11px] text-subtle sm:px-5">
                        Count reflects {fetchedTicketCount} fetched tickets,
                        not all {query.data?.total} server records.
                      </p>
                    )}

                  {query.isLoading ? (
                    <div
                      className="m-4 h-20 animate-pulse rounded-lg bg-soft"
                      aria-label="Loading unassigned tickets"
                    />
                  ) : query.isError ? (
                    <div className="p-4">
                      <p className="text-sm text-red-600">
                        Could not load unassigned tickets.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-3"
                        onClick={() => query.refetch()}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : unassignedTickets.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[660px] table-fixed border-collapse text-left text-xs">
                        <colgroup>
                          <col className="w-[6%]" />
                          <col className="w-[12%]" />
                          <col className="w-[32%]" />
                          <col className="w-[14%]" />
                          <col className="w-[14%]" />
                          <col className="w-[22%]" />
                        </colgroup>
                        <thead className="bg-soft/50 text-[10px] font-semibold text-subtle">
                          <tr>
                            {[
                              '#',
                              'Ticket ID',
                              'Title',
                              'Status',
                              'Priority',
                              'Created',
                            ].map((heading) => (
                              <th
                                key={heading}
                                scope="col"
                                className="whitespace-nowrap px-2 py-3 align-middle sm:px-3"
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {unassignedTickets.slice(0, 5).map((ticket, index) => {
                            const [date, time] = formatDateParts(
                              ticket.incidentLoggedOn ?? ticket.incidentOn,
                            )
                            const formattedDate = fmtDate(
                              ticket.incidentLoggedOn ?? ticket.incidentOn,
                            )

                            return (
                              <tr key={ticket.ticketId} className="align-middle">
                                <td className="px-2 py-3 font-medium text-subtle sm:px-3">
                                  {index + 1}
                                </td>
                                <td className="whitespace-nowrap px-2 py-3 font-mono font-semibold sm:px-3">
                                  #{ticket.ticketId}
                                </td>
                                <td className="px-2 py-3 sm:px-3">
                                  <span
                                    className="line-clamp-2 break-words font-medium leading-4"
                                    title={ticket.ticketTitle}
                                  >
                                    {ticket.ticketTitle}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-2 py-3 sm:px-3">
                                  <StatusBadge status={ticket.status} />
                                </td>
                                <td className="whitespace-nowrap px-2 py-3 sm:px-3">
                                  <LevelBadge level={ticket.priority} />
                                </td>
                                <td
                                  className="px-2 py-3 text-[10px] leading-4 text-subtle sm:px-3"
                                  title={formattedDate}
                                >
                                  <span className="block whitespace-nowrap">
                                    {date}
                                  </span>
                                  {time && (
                                    <span className="block whitespace-nowrap">
                                      {time}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {unassignedTickets.length > 5 && (
                        <p className="border-t border-line px-4 py-2 text-xs text-subtle">
                          Showing the 5 most recent of{' '}
                          {unassignedTickets.length} unassigned tickets in
                          fetched results.
                        </p>
                      )}
                      <div className="border-t border-line px-4 py-3 text-right">
                        <Link
                          to="/tickets"
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          View all tickets
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm text-subtle">
                        No unassigned tickets in the fetched results.
                      </p>
                      <Link
                        to="/tickets"
                        className="mt-3 inline-flex text-xs font-semibold text-brand hover:underline"
                      >
                        View all tickets
                      </Link>
                    </div>
                  )}
                </Card>

                <Card className="p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Headset className="size-4 text-brand" />
                    <h2 className="font-semibold">Need a custom report?</h2>
                  </div>
                  <p className="mt-2 text-sm text-subtle">
                    Contact the support team to request a report tailored to
                    your workflow.
                  </p>
                  <Link
                    to="/faq"
                    className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline"
                  >
                    Contact support
                  </Link>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, Cpu, Plus, RefreshCw,
  ShieldAlert, Ticket, TicketCheck, Users, Wrench,
} from 'lucide-react'
import { devicesApi } from '../api/devices'
import { ticketsApi } from '../api/tickets'
import { usersApi } from '../api/users'
import { LevelBadge, SlaBadge, StatusBadge } from '../components/Badges'
import { SupportAgentFigure } from '../components/SupportAgentFigure'
import { Button, Card, cx } from '../components/ui'
import { fmtDate } from '../lib/format'
import { getErrorMessage } from '../lib/http'
import type { Ticket as TicketRecord } from '../types'

const priorityOrder = ['Critical', 'High', 'Medium', 'Low']
const statusOrder = ['Open', 'Assigned', 'Escalated', 'Resolved', 'Closed']

const priorityColors: Record<string, string> = {
  Critical: '#f43f5e',
  High: '#fb923c',
  Medium: '#fbbf24',
  Low: '#3b82f6',
}

const statusColors: Record<string, string> = {
  Open: '#3b82f6',
  Assigned: '#fb923c',
  Escalated: '#8b5cf6',
  Resolved: '#10b981',
  Closed: '#64748b',
}

const isDone = (status?: string | null) =>
  ['resolved', 'closed'].includes((status ?? '').toLowerCase())

const toLocalDateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const formatDateRange = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

function DonutChart({
  total,
  values,
  centerLabel,
}: {
  total: number
  values: { name: string; count: number; color: string }[]
  centerLabel: string
}) {
  let current = 0

  const gradient = total > 0
    ? values.map((item) => {
        const start = current
        current += item.count / total * 100
        return `${item.color} ${start}% ${current}%`
      }).join(', ')
    : '#e7eaf1 0% 100%'

  return (
    <div
      className="relative grid size-36 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${gradient})` }}
    >
      <div className="grid size-[5.5rem] place-content-center rounded-full bg-surface text-center shadow-sm">
        <strong className="text-2xl tracking-tight">{total}</strong>
        <span className="text-[10px] text-subtle">{centerLabel}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const today = toLocalDateValue(new Date())
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const [fromDate, setFromDate] = useState(toLocalDateValue(sevenDaysAgo))
  const [toDate, setToDate] = useState(today)
  const [datePreset, setDatePreset] = useState('7')

  const ticketQuery = useQuery({
    queryKey: ['dashboard-tickets'],
    queryFn: () => ticketsApi.list({ page: 1, pageSize: 100 }),
  })

  const deviceQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.list(),
  })

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  })

  const allTickets = ticketQuery.data?.items ?? []
  const devices = deviceQuery.data ?? []
  const users = usersQuery.data ?? []

  const validDateRange = fromDate <= toDate
  const tickets = useMemo(() => allTickets.filter((ticket) => {
    const created = (ticket.incidentLoggedOn ?? ticket.incidentOn ?? '').slice(0, 10)
    return validDateRange && created >= fromDate && created <= toDate
  }), [allTickets, fromDate, toDate, validDateRange])

  const stats = useMemo(() => {
    const completed = tickets.filter((ticket) => isDone(ticket.status))

    const byPriority = priorityOrder.map((name) => ({
      name,
      count: tickets.filter(
        (ticket) =>
          (ticket.priority ?? '').toLowerCase() === name.toLowerCase(),
      ).length,
      color: priorityColors[name],
    }))

    const byStatus = statusOrder.map((name) => ({
      name,
      count: tickets.filter(
        (ticket) =>
          (ticket.status ?? '').toLowerCase() === name.toLowerCase(),
      ).length,
      color: statusColors[name],
    }))

    const breached = tickets.filter((ticket) => ticket.slaBreached).length
    const onTime = completed.filter((ticket) => !ticket.slaBreached).length
    return {
      completed,
      open: tickets.length - completed.length,
      breached,
      byPriority,
      byStatus,
      sla: completed.length
        ? Math.round((onTime / completed.length) * 100)
        : null,
      onTime,
    }
  }, [tickets])

  const recentTickets = useMemo(
    () =>
      [...tickets]
        .sort(
          (a, b) =>
            new Date(
              b.updatedAt ?? b.incidentLoggedOn ?? b.incidentOn ?? 0,
            ).getTime() -
            new Date(
              a.updatedAt ?? a.incidentLoggedOn ?? a.incidentOn ?? 0,
            ).getTime(),
        )
        .slice(0, 5),
    [tickets],
  )

  const trend = useMemo(() => {
    if (!validDateRange) return []

    const start = new Date(`${fromDate}T12:00:00`)
    const end = new Date(`${toDate}T12:00:00`)
    const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
    const bucketCount = Math.min(7, dayCount)

    return Array.from({ length: bucketCount }, (_, index) => {
      const startOffset = Math.floor(index * dayCount / bucketCount)
      const endOffset = Math.floor((index + 1) * dayCount / bucketCount) - 1
      const bucketStart = new Date(start)
      const bucketEnd = new Date(start)
      bucketStart.setDate(start.getDate() + startOffset)
      bucketEnd.setDate(start.getDate() + endOffset)
      const bucketStartKey = toLocalDateValue(bucketStart)
      const bucketEndKey = toLocalDateValue(bucketEnd)
      const inBucket = (value?: string | null) => {
        const date = (value ?? '').slice(0, 10)
        return date >= bucketStartKey && date <= bucketEndKey
      }

      return {
        date: bucketStartKey,
        label: bucketStartKey === bucketEndKey
          ? formatDateRange(bucketStartKey).replace(/, \d{4}$/, '')
          : `${formatDateRange(bucketStartKey).replace(/, \d{4}$/, '')}–${formatDateRange(bucketEndKey).replace(/, \d{4}$/, '')}`,
        created: tickets.filter((ticket) => inBucket(ticket.incidentLoggedOn ?? ticket.incidentOn)).length,
        completed: stats.completed.filter((ticket) => inBucket(ticket.resolvedAt ?? ticket.closedAt ?? ticket.updatedAt)).length,
      }
    })
  }, [fromDate, toDate, validDateRange, tickets, stats.completed])

  const maxTrend = Math.max(
    1,
    ...trend.map((point) => Math.max(point.created, point.completed)),
  )

  const linePoints = (key: 'created' | 'completed') =>
    trend
      .map(
        (point, index) =>
          `${24 + index * 96},${106 - (point[key] / maxTrend) * 82}`,
      )
      .join(' ')

  const total = tickets.length
  const setPreset = (value: string) => {
    setDatePreset(value)
    if (value === 'custom') return
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - (Number(value) - 1))
    setFromDate(toLocalDateValue(start))
    setToDate(toLocalDateValue(end))
  }

  return (
    <div className="page-enter min-w-0 space-y-4 sm:space-y-5">
      {/* Dashboard hero */}
      <section className="dashboard-hero relative isolate overflow-hidden rounded-2xl border border-indigo-200/70 p-5 dark:border-indigo-400/15 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
          <div className="relative z-10 min-w-0 flex-1">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
              Service operations · Live overview
            </p>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
              IT support, <span className="text-brand">without the chaos.</span>
            </h1>

            <p className="mt-1.5 max-w-xl text-sm text-subtle">
              Ticket pressure, service-level risk and support workload in one operational view.
            </p>

            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  ticketQuery.refetch()
                  deviceQuery.refetch()
                  usersQuery.refetch()
                }}
              >
                <RefreshCw
                  className={cx(
                    'size-4',
                    ticketQuery.isFetching && 'animate-spin',
                  )}
                />
                Refresh overview
              </Button>
            </div>
          </div>
          <SupportAgentFigure className="mx-auto h-32 w-full max-w-[300px] shrink-0 sm:mx-0 sm:h-36 sm:w-[240px] lg:h-48 lg:w-[360px]" />
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Dashboard overview</h2>
          <p className="mt-0.5 text-xs text-subtle">Ticket metrics for the selected date range</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 shadow-sm">
          <CalendarDays className="ml-1 size-4 shrink-0 text-brand" />
          <span className="hidden text-xs font-medium text-subtle sm:inline">
            {formatDateRange(fromDate)} – {formatDateRange(toDate)}
          </span>
          <select
            aria-label="Dashboard date range"
            value={datePreset}
            onChange={(event) => setPreset(event.target.value)}
            className="max-w-36 cursor-pointer rounded-lg border-0 bg-transparent py-1.5 pl-1 pr-6 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          {datePreset === 'custom' && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-line pt-2 sm:w-auto sm:border-0 sm:pt-0">
              <label className="flex items-center gap-1 text-[10px] font-medium text-subtle">
                From
                <input
                  type="date"
                  aria-label="Start date"
                  value={fromDate}
                  max={toDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-32 rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
                />
              </label>
              <label className="flex items-center gap-1 text-[10px] font-medium text-subtle">
                To
                <input
                  type="date"
                  aria-label="End date"
                  value={toDate}
                  min={fromDate}
                  max={today}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-32 rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
                />
              </label>
            </div>
          )}
        </div>
      </div>
      {!validDateRange && <p role="alert" className="text-xs text-red-600">Start date must be on or before the end date.</p>}

      {/* API error */}
      {ticketQuery.isError && (
        <Card className="flex items-center gap-3 border-red-200 p-4 text-sm text-red-700">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{getErrorMessage(ticketQuery.error)}</span>
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => ticketQuery.refetch()}
          >
            Retry
          </Button>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total tickets',
            value: total,
            note: 'Records returned by ticket service',
            icon: Ticket,
            tone: 'text-brand bg-indigo-500/10',
          },
          {
            label: 'Open tickets',
            value: stats.open,
            note: 'Not yet resolved or closed',
            icon: Clock3,
            tone: 'text-amber-600 bg-amber-500/10',
          },
          {
            label: 'SLA breached',
            value: stats.breached,
            note: 'Flagged by the ticket service',
            icon: ShieldAlert,
            tone: 'text-red-600 bg-red-500/10',
          },
          {
            label: 'Resolved tickets',
            value: stats.completed.length,
            note: 'In selected date range',
            icon: CheckCircle2,
            tone: 'text-emerald-600 bg-emerald-500/10',
          },
        ].map(({ label, value, note, icon: Icon, tone }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-subtle">{label}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight">
                  {ticketQuery.isLoading ? '—' : value}
                </p>
              </div>
              <span
                className={cx(
                  'grid size-10 place-items-center rounded-full',
                  tone,
                )}
              >
                <Icon className="size-5" />
              </span>
            </div>
            <p className="mt-2 text-[11px] text-subtle">{note}</p>
          </Card>
        ))}
      </div>

      {/* Trend and distribution charts */}
      <div className="grid min-w-0 gap-4 2xl:grid-cols-[1.45fr_0.8fr_0.8fr] xl:grid-cols-[1.3fr_0.85fr]">
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-brand">TICKET OVERVIEW</p>
              <h2 className="mt-1 font-semibold">Created vs. resolved</h2>
              <p className="mt-1 text-xs text-subtle">
                Daily ticket activity · selected date range
              </p>
            </div>
            <Activity className="size-5 text-brand" />
          </div>

          <div className="mt-4 overflow-hidden">
            <svg
              viewBox="0 0 624 132"
              role="img"
              aria-label="Created and resolved ticket trend"
              className="h-36 w-full overflow-visible"
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
                points={linePoints('created')}
                fill="none"
                stroke="#ec2380"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <polyline
                points={linePoints('completed')}
                fill="none"
                stroke="#7257ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {trend.map((point, index) => (
                <g key={point.date}>
                  <circle
                    cx={24 + index * 96}
                    cy={106 - (point.created / maxTrend) * 82}
                    r="3"
                    fill="#ec2380"
                  />
                  <circle
                    cx={24 + index * 96}
                    cy={106 - (point.completed / maxTrend) * 82}
                    r="3"
                    fill="#7257ff"
                  />
                  <text
                    x={24 + index * 96}
                    y="128"
                    textAnchor="middle"
                    className="fill-subtle text-[10px]"
                  >
                    {point.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-1 flex gap-4 text-[11px] text-subtle">
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-indigo-500" />
              Created
            </span>
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-violet-500" />
              Resolved
            </span>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-brand">PRIORITY DISTRIBUTION</p>
              <h2 className="mt-1 font-semibold">Tickets by priority</h2>
            </div>
            <BarChart3 className="size-5 text-brand" />
          </div>

          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <DonutChart
              total={total}
              centerLabel="Total tickets"
              values={stats.byPriority.map((item) => ({
                name: item.name,
                count: item.count,
                color: item.color,
              }))}
            />

            <div className="w-full space-y-2.5">
              {stats.byPriority.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <i
                      className="size-2 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {item.count}{' '}
                    <span className="font-normal text-subtle">
                      ({total ? Math.round((item.count / total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-brand">STATUS OVERVIEW</p>
              <h2 className="mt-1 font-semibold">Ticket status mix</h2>
            </div>
            <TicketCheck className="size-5 text-brand" />
          </div>

          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <DonutChart
              total={total}
              centerLabel="Total tickets"
              values={stats.byStatus.map((item) => ({
                name: item.name,
                count: item.count,
                color: item.color,
              }))}
            />

            <div className="w-full space-y-2.5">
              {stats.byStatus.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <i
                      className="size-2 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-semibold tabular-nums">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent tickets, quick actions and support panel */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.5fr_0.65fr_0.9fr]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line p-4 sm:p-5">
            <div>
              <h2 className="font-semibold">Recent tickets</h2>
              <p className="mt-1 text-xs text-subtle">Latest ticket activity</p>
            </div>
            <Link
              to="/tickets"
              className="text-xs font-semibold text-brand hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-soft/70 text-[10px] uppercase tracking-wider text-subtle">
                <tr>
                  {['Ticket / ID', 'Priority', 'Status', 'SLA', 'Updated'].map(
                    (label) => (
                      <th key={label} className="px-3 py-3 font-semibold">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {recentTickets.map((ticket: TicketRecord) => (
                  <tr
                    key={ticket.ticketId}
                    className="transition hover:bg-soft/50"
                  >
                    <td className="max-w-[250px] px-3 py-3">
                      <div className="truncate font-medium">{ticket.ticketTitle}</div>
                      <span className="font-mono text-[10px] text-subtle">
                        #{ticket.ticketId}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <LevelBadge level={ticket.priority} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-3 py-3">
                      <SlaBadge
                        breached={ticket.slaBreached}
                        status={ticket.status}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-subtle">
                      {fmtDate(
                        ticket.updatedAt ??
                        ticket.incidentLoggedOn ??
                        ticket.incidentOn,
                      )}
                    </td>
                  </tr>
                ))}

                {!recentTickets.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-subtle">
                      No ticket activity available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/10 text-brand">
              <Wrench className="size-4" />
            </span>
            <h2 className="font-semibold">Quick actions</h2>
          </div>

          <div className="mt-4 space-y-1">
            <Link
              to="/tickets/new"
              className="flex items-center justify-between rounded-lg px-2.5 py-3 text-sm transition hover:bg-indigo-500/5"
            >
              <span className="flex items-center gap-2">
                <Plus className="size-4 text-brand" />
                Create new ticket
              </span>
              <span className="text-brand">›</span>
            </Link>

            <Link
              to="/tickets"
              className="flex items-center justify-between rounded-lg px-2.5 py-3 text-sm transition hover:bg-indigo-500/5"
            >
              <span className="flex items-center gap-2">
                <Ticket className="size-4 text-brand" />
                Browse tickets
              </span>
              <span className="text-brand">›</span>
            </Link>

            <Link
              to="/reports"
              className="flex items-center justify-between rounded-lg px-2.5 py-3 text-sm transition hover:bg-indigo-500/5"
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="size-4 text-brand" />
                View reports
              </span>
              <span className="text-brand">›</span>
            </Link>

            <Link
              to="/admin/users"
              className="flex items-center justify-between rounded-lg px-2.5 py-3 text-sm transition hover:bg-indigo-500/5"
            >
              <span className="flex items-center gap-2">
                <Users className="size-4 text-brand" />
                Manage users
              </span>
              <span className="text-brand">›</span>
            </Link>
          </div>
        </Card>

        <Card className="relative min-h-56 overflow-hidden border-indigo-100 bg-gradient-to-br from-white via-indigo-50 to-blue-100 p-4 dark:border-indigo-400/15 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40 sm:p-5">
          <div className="relative z-10 max-w-[60%]">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">
              Support that works for you
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              Your service team, at a glance.
            </h2>
            <p className="mt-2 text-xs leading-5 text-subtle">
              Keep tickets moving and help your team resolve issues faster.
            </p>
            <Link
              to="/faq"
              className="mt-3 inline-flex text-xs font-semibold text-brand hover:underline"
            >
              Visit support centre →
            </Link>
          </div>

        </Card>
      </div>

      {/* Additional service information */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-sm text-subtle">
            <Cpu className="size-4 text-brand" />
            Registered devices
          </span>
          <strong className="text-lg">
            {deviceQuery.isLoading ? '—' : devices.length}
          </strong>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-sm text-subtle">
            <Users className="size-4 text-brand" />
            Directory users
          </span>
          <strong className="text-lg">
            {usersQuery.isLoading ? '—' : users.length}
          </strong>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-sm text-subtle">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Completed-ticket SLA
          </span>
          <strong className="text-lg">
            {stats.sla === null ? 'N/A' : `${stats.sla}%`}
          </strong>
        </Card>
      </div>
    </div>
  )
}
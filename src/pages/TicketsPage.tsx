import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Eye, Pencil, Plus, RefreshCw, Search, SearchX, TriangleAlert, UserRound, X } from 'lucide-react'
import { ticketsApi } from '../api/tickets'
import { usersApi } from '../api/users'
import { useAuth } from '../auth/AuthContext'
import { LevelBadge, SlaBadge, StatusBadge } from '../components/Badges'
import { Button, Card, Input, Select, cx } from '../components/ui'
import TicketDetailPage from './TicketDetailPage'
import { PRIORITIES, SEVERITIES } from '../lib/constants'
import { fmtDate } from '../lib/format'
import { getErrorMessage } from '../lib/http'
import { useDebounce } from '../lib/useDebounce'

const QUICK_STATUS = ['', 'Open', 'Assigned', 'Escalated', 'Resolved', 'Closed']

export default function TicketsPage() {
  const queryClient = useQueryClient()
  const { hasRole, can } = useAuth()

  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [severity, setSeverity] = useState('')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const search = useDebounce(searchText.trim(), 400)
  const [viewTicketId, setViewTicketId] = useState<number | null>(null)
  const [actionTicket, setActionTicket] = useState<{ id: number; title: string; action: 'assign' | 'resolve' } | null>(null)
  const [actionValue, setActionValue] = useState('')
  const [actionError, setActionError] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['tickets', { status, priority, severity, search, page, pageSize }],
    queryFn: () => ticketsApi.list({ status, priority, severity, search, page, pageSize }),
    placeholderData: keepPreviousData,
  })
  const assigneesQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: actionTicket?.action === 'assign',
    staleTime: 5 * 60 * 1000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? null
  const hasNext = total !== null ? page * pageSize < total : items.length === pageSize
  const totalPages = total !== null ? Math.max(1, Math.ceil(total / pageSize)) : null
  const from = items.length ? (page - 1) * pageSize + 1 : 0
  const to = items.length ? from + items.length - 1 : 0
  const canCreate = !hasRole('Viewer')
  const canEdit = can('ticket.update') || hasRole('Admin', 'Manager', 'Agent')
  const canWorkTicket = canEdit || can('ticket.resolve') || hasRole('Admin', 'Manager', 'Agent')

  const updateTicket = useMutation({
    mutationFn: async () => {
      if (!actionTicket) throw new Error('Select a ticket action first.')
      if (!actionValue.trim()) {
        throw new Error(actionTicket.action === 'assign' ? 'Enter an assignee ID or email.' : 'Enter a resolution note.')
      }
      return actionTicket.action === 'assign'
        ? ticketsApi.assign(actionTicket.id, actionValue.trim())
        : ticketsApi.resolve(actionTicket.id, actionValue.trim())
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['reports-tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['header-notifications'] }),
      ])
      setActionTicket(null)
      setActionValue('')
      setActionError('')
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })

  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }

  return (
    <div className="page-enter min-w-0">
      <div className="dashboard-hero relative isolate overflow-hidden rounded-2xl border border-indigo-200/70 p-5 dark:border-indigo-400/15 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Service desk · Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tickets</h1>
          <p className="mt-1.5 text-sm text-subtle">All incidents, work orders, and change requests in one place.</p>
        </div>
        {canCreate && (
          <Link to="/tickets/new">
            <Button>
              <Plus className="size-4" /> Create Ticket
            </Button>
          </Link>
        )}
        </div>
      </div>

      {/* Quick status pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        {QUICK_STATUS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => reset(setStatus)(s)}
            className={cx(
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              status === s ? 'bg-brand text-brand-ink shadow-sm shadow-indigo-500/25' : 'border border-line bg-surface text-subtle hover:text-ink',
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <Card className="mt-5 overflow-hidden">
        {/* Filters */}
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto]">
          <Input
            icon={<Search className="size-4" />}
            placeholder="Search by title or description…"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value)
              setPage(1)
            }}
          />
          <Select value={priority} onChange={(e) => reset(setPriority)(e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select value={severity} onChange={(e) => reset(setSeverity)(e.target.value)}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => refetch()} title="Refresh">
            <RefreshCw className={cx('size-4', isFetching && 'animate-spin')} />
          </Button>
        </div>

        {isError ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <TriangleAlert className="size-9 text-red-500" />
            <p className="mt-3 font-medium">Could not load tickets</p>
            <p className="mt-1 max-w-md text-sm text-subtle">{getErrorMessage(error)}</p>
            <Button variant="outline" className="mt-5" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[1405px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[400px]" />
                <col className="w-[125px]" />
                <col className="w-[105px]" />
                <col className="w-[90px]" />
                <col className="w-[130px]" />
                <col className="w-[95px]" />
                <col className="w-[460px]" />
              </colgroup>
              <thead className="bg-soft/80 text-[11px] uppercase tracking-[0.12em] text-subtle">
                <tr>
                  {['Ticket', 'Generated By', 'Status', 'Priority', 'Assigned to', 'SLA', 'Actions'].map((h) => (
                    <th key={h} className={cx('px-3 py-3 font-semibold', h === 'Actions' && 'whitespace-nowrap text-center')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-3 py-4">
                          <div className="h-4 animate-pulse rounded bg-soft" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!isLoading &&
                  items.map((t) => {
                    const normalizedStatus = t.status.trim().toLowerCase()
                    const isResolved = normalizedStatus === 'resolved'
                    const isClosed = normalizedStatus === 'closed'
                    const isTerminal = isResolved || isClosed
                    const isAssigned = normalizedStatus === 'assigned'

                    return (
                    <tr key={t.ticketId} className="transition-colors hover:bg-indigo-50/70 dark:hover:bg-indigo-400/5">
                      <td className="px-3 py-3.5">
                        <div className="flex min-w-0 items-baseline">
                          <span className="min-w-0 truncate font-medium">{t.ticketTitle}</span>
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-subtle">
                          <span className="min-w-0 flex-1 truncate">
                            {[t.category, t.subCategory].filter(Boolean).join(' › ') || '—'}
                          </span>
                          <span className="shrink-0 whitespace-nowrap">
                            <span className="font-medium">Created At:</span>{' '}
                            {fmtDate(t.incidentLoggedOn ?? t.incidentOn)}
                          </span>
                        </div>
                      </td>
                      <td className="truncate px-3 py-3.5 text-subtle" title={t.incidentLoggedBy?.trim() || '—'}>{t.incidentLoggedBy?.trim() || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3.5"><StatusBadge status={t.status} /></td>
                      <td className="whitespace-nowrap px-3 py-3.5"><LevelBadge level={t.priority} /></td>
                      <td className="truncate px-3 py-3.5 text-subtle" title={t.assignedToId || 'Unassigned'}>{t.assignedToId || 'Unassigned'}</td>
                      <td className="whitespace-nowrap px-3 py-3.5"><SlaBadge breached={t.slaBreached} status={t.status} /></td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <div className="flex w-full flex-nowrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewTicketId(t.ticketId)}
                            aria-label={`View ticket ${t.ticketId}`}
                            title="View details"
                            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          >
                            <Eye className="size-4" />View
                          </button>
                          {canEdit && !isAssigned && !isTerminal && (
                            <Button
                              variant="outline"
                              className="h-11 shrink-0 gap-1.5 px-4 py-0 text-sm"
                              title="Assign ticket"
                              aria-label={`Assign ticket ${t.ticketId}`}
                              onClick={() => {
                                setActionTicket({ id: t.ticketId, title: t.ticketTitle, action: 'assign' })
                                setActionValue('')
                                setActionError('')
                              }}
                            >
                              <UserRound className="size-4" />Assign
                            </Button>
                          )}
                          {!isTerminal && canWorkTicket ? (
                            <Button
                              title="Resolve ticket"
                              aria-label={`Resolve ticket ${t.ticketId}`}
                              className="h-11 shrink-0 gap-1.5 px-4 py-0 text-sm"
                              onClick={() => {
                                setActionTicket({ id: t.ticketId, title: t.ticketTitle, action: 'resolve' })
                                setActionValue('')
                                setActionError('')
                              }}
                            >
                              <Check className="size-4" />Resolve
                            </Button>
                          ) : null}
                          {canEdit && (
                            <Link
                              to={`/tickets/${t.ticketId}/edit`}
                              aria-label={`Edit ticket ${t.ticketId}`}
                              title="Edit ticket"
                              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                            >
                              <Pencil className="size-4" />Edit
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
              </tbody>
            </table>

            {!isLoading && items.length === 0 && (
              <div className="grid place-items-center px-6 py-16 text-center">
                <SearchX className="size-9 text-subtle" />
                <p className="mt-3 font-medium">No tickets found</p>
                <p className="mt-1 text-sm text-subtle">Try adjusting your filters.</p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
          <p className="text-subtle">
            {items.length ? `${from}–${to}` : '0'} {total !== null && <>of {total}</>} tickets
          </p>
          <div className="flex items-center gap-3">
            <Select
              className="w-auto"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </Select>
            <span className="text-subtle">
              Page {page}
              {totalPages ? ` / ${totalPages}` : ''}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" className="px-2.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" className="px-2.5" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {actionTicket && createPortal(
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !updateTicket.isPending) setActionTicket(null)
          }}
        >
          <Card role="dialog" aria-modal="true" aria-labelledby="ticket-list-action-title" className="w-full max-w-md p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="ticket-list-action-title" className="text-lg font-semibold">
                  {actionTicket.action === 'assign' ? 'Assign ticket' : 'Resolve ticket'}
                </h2>
                <p className="mt-1 text-sm text-subtle">#{actionTicket.id}: {actionTicket.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setActionTicket(null)}
                disabled={updateTicket.isPending}
                className="rounded-lg p-1.5 text-subtle hover:bg-soft"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>
            </div>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium">
                {actionTicket.action === 'assign' ? 'Assign to user' : 'Resolution note'}
              </span>
              {actionTicket.action === 'assign' ? (
                <Select
                  autoFocus
                  required
                  value={actionValue}
                  onChange={(event) => setActionValue(event.target.value)}
                  disabled={assigneesQuery.isLoading || assigneesQuery.isError}
                >
                  <option value="">
                    {assigneesQuery.isLoading ? 'Loading users…' : assigneesQuery.isError ? 'Could not load users' : 'Select a user'}
                  </option>
                  {(assigneesQuery.data ?? []).map((user) => (
                    <option key={user.id} value={user.email || user.id}>
                      {user.email || user.id}{user.roles?.length ? ` · ${user.roles.join(', ')}` : ''}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  autoFocus
                  value={actionValue}
                  onChange={(event) => setActionValue(event.target.value)}
                  placeholder="Add a short resolution note"
                />
              )}
            </label>
            {actionTicket.action === 'assign' && assigneesQuery.isError && (
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-red-500">
                <span role="alert">Could not load users: {getErrorMessage(assigneesQuery.error)}</span>
                <Button type="button" variant="outline" onClick={() => assigneesQuery.refetch()}>Retry</Button>
              </div>
            )}
            {actionTicket.action === 'assign' && assigneesQuery.isSuccess && !assigneesQuery.data.length && (
              <p role="status" className="mt-2 text-sm text-subtle">No users are available to assign.</p>
            )}
            {actionError && <p role="alert" className="mt-3 text-sm text-red-500">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" disabled={updateTicket.isPending} onClick={() => setActionTicket(null)}>Cancel</Button>
              <Button loading={updateTicket.isPending} onClick={() => updateTicket.mutate()}>
                {actionTicket.action === 'assign' ? 'Assign' : 'Resolve'}
              </Button>
            </div>
          </Card>
        </div>,
        document.body,
      )}
      {viewTicketId !== null && (
        <TicketDetailPage ticketId={viewTicketId} onClose={() => setViewTicketId(null)} />
      )}
    </div>
  )
}

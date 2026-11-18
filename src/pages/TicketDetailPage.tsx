import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ClipboardList, Clock3, Download, FileText, Paperclip, Pencil, RefreshCw, ShieldCheck, Trash2, TriangleAlert, Upload, UserRound, X } from 'lucide-react'
import { ticketsApi } from '../api/tickets'
import { usersApi } from '../api/users'
import { useAuth } from '../auth/AuthContext'
import { LevelBadge, SlaBadge, SourceBadge, StatusBadge } from '../components/Badges'
import { Button, Card, Field, Input, Select, cx } from '../components/ui'
import { fmtDate } from '../lib/format'
import { getErrorMessage } from '../lib/http'
import type { Ticket } from '../types'

type Action = 'assign' | 'resolve' | 'close' | 'approve' | 'reject' | 'delete'
type Tab = 'overview' | 'assignments' | 'audit' | 'attachments'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readable(value: unknown): string {
  if (!isRecord(value)) return String(value ?? '—')
  return String(value.action ?? value.event ?? value.description ?? value.status ?? value.userName ?? value.assignedTo ?? JSON.stringify(value))
}

function ActivityList({ rows, empty }: { rows: unknown[]; empty: string }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-subtle">{empty}</p>
  return <div className="divide-y divide-line">{rows.map((row, index) => <div key={index} className="flex gap-3 py-4"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Clock3 className="size-4" /></span><p className="min-w-0 break-words pt-1 text-sm">{readable(row)}</p></div>)}</div>
}

export default function TicketDetailPage({ ticketId: ticketIdProp, onClose }: { ticketId?: number; onClose?: () => void } = {}) {
  const { id } = useParams()
  const ticketId = ticketIdProp ?? Number(id)
  const navigate = useNavigate()
  const client = useQueryClient()
  const { can, hasRole } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [action, setAction] = useState<Action | null>(null)
  const [value, setValue] = useState('')
  const [actionError, setActionError] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentDescription, setAttachmentDescription] = useState('')
  const [attachmentError, setAttachmentError] = useState('')

  useEffect(() => {
    if (!onClose) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  const present = (content: ReactNode) => onClose ? (
    createPortal(
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-3 sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <Card role="dialog" aria-modal="true" aria-label="Ticket details" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
            <p className="text-sm font-semibold">Ticket details</p>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-subtle hover:bg-soft" aria-label="Close ticket details">
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto">{content}</div>
        </Card>
      </div>,
      document.body,
    )
  ) : content

  const ticketQuery = useQuery({ queryKey: ['ticket', ticketId], queryFn: () => ticketsApi.get(ticketId), enabled: Number.isFinite(ticketId) })
  const ticket = ticketQuery.data
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    staleTime: 1000 * 60 * 5,
  })
  const assignmentQuery = useQuery({ queryKey: ['ticket', ticketId, 'assignments'], queryFn: () => ticketsApi.assignments(ticketId), enabled: tab === 'assignments' })
  const auditQuery = useQuery({ queryKey: ['ticket', ticketId, 'audit'], queryFn: () => ticketsApi.audit(ticketId), enabled: tab === 'audit' })
  const attachmentsQuery = useQuery({ queryKey: ['ticket', ticketId, 'attachments'], queryFn: () => ticketsApi.attachments(ticketId), enabled: tab === 'attachments' })

  const uploadAttachment = useMutation({
    mutationFn: () => {
      if (!attachmentFile) throw new Error('Choose a file to upload.')
      return ticketsApi.uploadAttachment(ticketId, attachmentFile, attachmentDescription.trim())
    },
    onSuccess: async () => {
      setAttachmentFile(null)
      setAttachmentDescription('')
      setAttachmentError('')
      await client.invalidateQueries({ queryKey: ['ticket', ticketId, 'attachments'] })
      await client.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
    onError: (error) => setAttachmentError(getErrorMessage(error)),
  })

  const downloadAttachment = async (attachment: Record<string, unknown>) => {
    const attachmentId = attachment.id ?? attachment.attachmentId ?? attachment.Id
    if (typeof attachmentId !== 'string' && typeof attachmentId !== 'number') {
      setAttachmentError('This attachment does not include a downloadable ID.')
      return
    }
    try {
      const response = await ticketsApi.downloadAttachment(ticketId, attachmentId)
      const disposition = response.headers['content-disposition'] as string | undefined
      const match = disposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)
      const fallbackName = attachment.fileName ?? attachment.name ?? `attachment-${attachmentId}`
      const filename = match ? decodeURIComponent(match[1].replaceAll('"', '')) : String(fallbackName)
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setAttachmentError('')
    } catch (error) {
      setAttachmentError(getErrorMessage(error))
    }
  }

  const actionTitle = { assign: 'Assign ticket', resolve: 'Resolve ticket', close: 'Close ticket', approve: 'Approve request', reject: 'Reject request', delete: 'Delete ticket' } as const
  const update = useMutation({
    mutationFn: async ({ kind, text }: { kind: Action; text: string }) => {
      if (kind === 'assign') return ticketsApi.assign(ticketId, text)
      if (kind === 'resolve') return ticketsApi.resolve(ticketId, text)
      if (kind === 'close') return ticketsApi.close(ticketId, text)
      if (kind === 'approve') return ticketsApi.approve(ticketId, text)
      if (kind === 'reject') return ticketsApi.reject(ticketId, text)
      return ticketsApi.remove(ticketId)
    },
    onSuccess: async (_, variables) => {
      await client.invalidateQueries({ queryKey: ['tickets'] })
      await client.invalidateQueries({ queryKey: ['ticket', ticketId] })
      setAction(null)
      setValue('')
      setActionError('')
      if (variables.kind === 'delete') navigate('/tickets', { replace: true })
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })

  const submitAction = () => {
    if (!action) return
    if (action === 'delete') {
      update.mutate({ kind: action, text: '' })
      return
    }
    if (['assign', 'resolve', 'close'].includes(action) && !value.trim()) {
      setActionError(action === 'assign' ? 'Enter an assignee ID or email.' : 'Enter a resolution note.')
      return
    }
    update.mutate({ kind: action, text: value.trim() })
  }

  if (!Number.isFinite(ticketId)) return present(<p className="py-16 text-center text-subtle">Invalid ticket number.</p>)
  if (ticketQuery.isLoading) return present(<div className="py-20 text-center text-sm text-subtle">Loading ticket…</div>)
  if (ticketQuery.isError || !ticket) return present(<Card className="mx-auto max-w-xl p-8 text-center"><TriangleAlert className="mx-auto size-8 text-amber-500" /><h1 className="mt-3 font-semibold">Ticket unavailable</h1><p className="mt-1 text-sm text-subtle">{getErrorMessage(ticketQuery.error)}</p>{onClose ? <Button variant="outline" className="mt-5" onClick={onClose}>Close</Button> : <Link to="/tickets"><Button variant="outline" className="mt-5">Back to tickets</Button></Link>}</Card>)

  const canEdit = can('ticket.update') || hasRole('Admin', 'Manager', 'Agent')
  const canWorkTicket = canEdit || can('ticket.resolve') || hasRole('Admin', 'Manager', 'Agent')
  const canApprove = hasRole('Admin', 'Manager', 'Approver') || can('ticket.approve')
  const normalizedStatus = ticket.status.trim().toLowerCase()
  const isResolved = normalizedStatus === 'resolved'
  const isClosed = normalizedStatus === 'closed'
  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'assignments', label: 'Assignment history', icon: UserRound },
    { id: 'audit', label: 'Audit trail', icon: ShieldCheck },
    { id: 'attachments', label: `Attachments (${ticket.attachmentCount ?? 0})`, icon: Paperclip },
  ]
  const activity = tab === 'assignments' ? assignmentQuery.data ?? [] : auditQuery.data ?? []
  const reporterDisplay = usersQuery.data?.find((entry) => entry.id === ticket.reporterId)?.email ?? ticket.reporterId

  return present(
    <div className={cx(onClose ? 'p-4 sm:p-6' : 'page-enter mx-auto max-w-6xl')}>
      {!onClose && <Link to="/tickets" className="inline-flex items-center gap-2 text-sm font-medium text-subtle transition hover:text-brand"><ArrowLeft className="size-4" /> All tickets</Link>}
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={ticket.status} /><SourceBadge source={ticket.ticketSource} /></div>
          <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{ticket.ticketTitle}</h1>
          <p className="mt-2 text-sm text-subtle">Created {fmtDate(ticket.incidentLoggedOn ?? ticket.incidentOn)}{ticket.incidentLoggedBy ? ` by ${ticket.incidentLoggedBy}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!onClose && canEdit && <Link to={`/tickets/${ticket.ticketId}/edit`}><Button variant="outline"><Pencil className="size-4" /> Edit</Button></Link>}
          {!onClose && canEdit && !isClosed && !isResolved && normalizedStatus !== 'assigned' && <Button variant="outline" onClick={() => { setAction('assign'); setActionError('') }}><UserRound className="size-4" /> Assign</Button>}
          {!onClose && canWorkTicket && !isResolved && !isClosed && <Button onClick={() => { setAction('resolve'); setActionError('') }}><Check className="size-4" /> Resolve</Button>}
          {canWorkTicket && isResolved && <Button variant="outline" onClick={() => { setAction('close'); setActionError('') }}>Close ticket</Button>}
          {canApprove && ticket.approvalStatus?.toLowerCase() === 'pending' && <><Button variant="outline" onClick={() => { setAction('approve'); setActionError('') }}>Approve</Button><Button variant="danger" onClick={() => { setAction('reject'); setActionError('') }}>Reject</Button></>}
          {can('ticket.delete') && <Button variant="ghost" onClick={() => { setAction('delete'); setActionError('') }} title="Delete ticket"><Trash2 className="size-4 text-red-500" /></Button>}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Priority', value: <LevelBadge level={ticket.priority} /> },
          { label: 'Severity', value: <LevelBadge level={ticket.severity} /> },
          { label: 'SLA status', value: <SlaBadge breached={ticket.slaBreached} status={ticket.status} /> },
          { label: 'Assigned to', value: <span className="truncate text-sm font-medium">{ticket.assignedToId || 'Unassigned'}</span> },
        ].map((item) => <Card key={item.label} className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-subtle">{item.label}</p><div className="mt-2">{item.value}</div></Card>)}
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3 sm:px-5">
          {tabs.map(({ id: tabId, label, icon: Icon }) => <button key={tabId} onClick={() => setTab(tabId)} type="button" className={cx('inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition', tab === tabId ? 'border-brand text-brand' : 'border-transparent text-subtle hover:text-ink')}><Icon className="size-4" />{label}</button>)}
        </div>
        <div className="p-5 sm:p-7">
          {tab === 'overview' && <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px]"><section><h2 className="font-semibold">Description</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-subtle">{ticket.description || 'No description provided.'}</p>{ticket.resolution && <div className="mt-6 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10"><p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Resolution</p><p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900 dark:text-emerald-200">{ticket.resolution}</p></div>}</section><aside className="rounded-xl bg-soft/70 p-4"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4 text-brand" /> Ticket details</h2><dl className="space-y-3 text-sm">{[['Type', ticket.ticketType], ['Category', [ticket.category, ticket.subCategory].filter(Boolean).join(' / ')], ['Reporter', reporterDisplay], ['Device', ticket.deviceId], ['Project', ticket.projectName], ['Landmark', ticket.landmark], ['Approval', ticket.approvalStatus], ['Updated', fmtDate(ticket.updatedAt)]].map(([key, val]) => <div key={key}><dt className="text-xs text-subtle">{key}</dt><dd className="mt-0.5 break-words font-medium">{val || '—'}</dd></div>)}</dl></aside></div>}
          {tab === 'assignments' && <><h2 className="font-semibold">Assignment history</h2>{assignmentQuery.isLoading ? <p className="py-8 text-sm text-subtle">Loading history…</p> : assignmentQuery.isError ? <p className="mt-3 text-sm text-red-500">{getErrorMessage(assignmentQuery.error)}</p> : <ActivityList rows={activity} empty="No assignment history available." />}</>}
          {tab === 'audit' && <><h2 className="font-semibold">Audit trail</h2>{auditQuery.isLoading ? <p className="py-8 text-sm text-subtle">Loading audit events…</p> : auditQuery.isError ? <p className="mt-3 text-sm text-red-500">{getErrorMessage(auditQuery.error)}</p> : <ActivityList rows={activity} empty="No audit events available." />}</>}
          {tab === 'attachments' && <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h2 className="font-semibold">Attachments</h2><p className="mt-1 text-sm text-subtle">{attachmentsQuery.data?.length ?? ticket.attachmentCount ?? 0} file(s) attached to this ticket.</p></div>
              <Button variant="outline" onClick={() => attachmentsQuery.refetch()} title="Refresh attachments"><RefreshCw className={`size-4 ${attachmentsQuery.isFetching ? 'animate-spin' : ''}`} /></Button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); uploadAttachment.mutate() }} className="grid gap-3 rounded-xl border border-line bg-soft/40 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Choose file"><Input type="file" required onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} /></Field>
              <Field label="Description (optional)"><Input value={attachmentDescription} onChange={(event) => setAttachmentDescription(event.target.value)} placeholder="What does this file contain?" /></Field>
              <Button type="submit" loading={uploadAttachment.isPending}><Upload className="size-4" />Upload</Button>
            </form>
            {attachmentError && <p role="alert" className="text-sm text-red-500">{attachmentError}</p>}
            {attachmentsQuery.isError && <div className="flex items-center gap-3 rounded-xl border border-red-200 p-4 text-sm text-red-600"><TriangleAlert className="size-5 shrink-0" />{getErrorMessage(attachmentsQuery.error)}<Button variant="outline" className="ml-auto" onClick={() => attachmentsQuery.refetch()}>Retry</Button></div>}
            {attachmentsQuery.isLoading ? <p className="py-8 text-center text-sm text-subtle">Loading attachments…</p> : (
              <div className="divide-y divide-line rounded-xl border border-line">
                {attachmentsQuery.data?.map((attachment, index) => {
                  const attachmentId = attachment.id ?? attachment.attachmentId ?? attachment.Id
                  const filename = attachment.fileName ?? attachment.name ?? attachment.originalFileName ?? `Attachment ${index + 1}`
                  const description = attachment.description
                  return <div key={String(attachmentId ?? index)} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Paperclip className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{String(filename)}</p>{typeof description === 'string' && <p className="mt-0.5 truncate text-xs text-subtle">{description}</p>}</div></div>
                    <Button variant="outline" onClick={() => downloadAttachment(attachment)}><Download className="size-4" />Download</Button>
                  </div>
                })}
                {!attachmentsQuery.isError && !attachmentsQuery.isLoading && !attachmentsQuery.data?.length && <p className="p-8 text-center text-sm text-subtle">No attachments have been uploaded yet.</p>}
              </div>
            )}
          </div>}
        </div>
      </Card>

      {action && createPortal(<div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAction(null) }}>
        <Card role="dialog" aria-modal="true" aria-labelledby="ticket-action-title" className="w-full max-w-md p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 id="ticket-action-title" className="text-lg font-semibold">{actionTitle[action]}</h2><p className="mt-1 text-sm text-subtle">{ticket.ticketTitle}</p></div><button type="button" onClick={() => setAction(null)} className="rounded-lg p-1.5 text-subtle hover:bg-soft"><X className="size-5" /></button></div>
          {action === 'delete' ? <div className="mt-5 flex gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"><TriangleAlert className="size-5 shrink-0" /><p>This permanently deletes the ticket if the backend supports DELETE for this endpoint.</p></div> : <div className="mt-5"><Field label={action === 'assign' ? 'Assign to user' : action === 'approve' || action === 'reject' ? 'Notes (optional)' : 'Resolution *'}>{action === 'assign' ? <Select autoFocus required value={value} onChange={(event) => setValue(event.target.value)} disabled={usersQuery.isLoading || usersQuery.isError}><option value="">{usersQuery.isLoading ? 'Loading users…' : usersQuery.isError ? 'Could not load users' : 'Select a user'}</option>{(usersQuery.data ?? []).map((user) => <option key={user.id} value={user.email || user.id}>{user.email || user.id}{user.roles?.length ? ` · ${user.roles.join(', ')}` : ''}</option>)}</Select> : <Input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="Add a short note" />}</Field>{action === 'assign' ? usersQuery.isError ? <div className="mt-2 flex items-center justify-between gap-3 text-sm text-red-500"><span role="alert">Could not load users: {getErrorMessage(usersQuery.error)}</span><Button type="button" variant="outline" onClick={() => usersQuery.refetch()}>Retry</Button></div> : usersQuery.isSuccess && !usersQuery.data.length ? <p role="status" className="mt-2 text-xs text-subtle">No users are available to assign.</p> : null : <p className="mt-2 text-xs text-subtle">{action === 'approve' || action === 'reject' ? 'These notes will be sent with the approval decision.' : 'A resolution note is required to continue.'}</p>}</div>}
          {actionError && <p role="alert" className="mt-3 text-sm text-red-500">{actionError}</p>}
          <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button><Button variant={action === 'delete' || action === 'reject' ? 'danger' : 'primary'} loading={update.isPending} onClick={submitAction}>{action === 'delete' ? 'Delete ticket' : actionTitle[action]}</Button></div>
        </Card>
      </div>, document.body)}
    </div>
  )
}

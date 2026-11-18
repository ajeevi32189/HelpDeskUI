import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, LoaderCircle, Pencil, Plus, RefreshCw, Save, Trash2, Wrench, X } from 'lucide-react'
import { adminConfigApi, getRecordId, type AdminRecord, type AdminResource } from '../api/adminConfig'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, Field, Input, Select } from '../components/ui'
import { getErrorMessage } from '../lib/http'
import { workOrderTemplatesApi } from '../api/tickets'

type FieldType = 'text' | 'email' | 'number' | 'textarea' | 'checkbox' | 'select'
interface ConfigField {
  name: string
  label: string
  type: FieldType
  required?: boolean
  min?: number
  maxLength?: number
  options?: { value: string; label: string }[]
}

interface ConfigDefinition {
  title: string
  description: string
  resource: AdminResource
  fields: ConfigField[]
  columns: { name: string; label: string; format?: (record: AdminRecord) => string }[]
  defaults: Record<string, string | boolean>
}

const definitions: Record<AdminResource, ConfigDefinition> = {
  sla: {
    title: 'SLA policies',
    description: 'Set the target resolution time used by tickets and escalation policies.',
    resource: 'sla',
    fields: [
      { name: 'name', label: 'Policy name', type: 'text', required: true, maxLength: 120 },
      { name: 'resolutionTimeInMinutes', label: 'Resolution target (minutes)', type: 'number', required: true, min: 1 },
    ],
    columns: [
      { name: 'name', label: 'Policy' },
      { name: 'resolutionTimeInMinutes', label: 'Resolution target', format: (row) => `${row.resolutionTimeInMinutes ?? '—'} min` },
    ],
    defaults: { name: '', resolutionTimeInMinutes: '60' },
  },
  escalation: {
    title: 'Escalation matrix',
    description: 'Configure escalation contacts and time thresholds for each SLA.',
    resource: 'escalation',
    fields: [
      { name: 'slaId', label: 'SLA', type: 'select', required: true, options: [] },
      { name: 'level', label: 'Escalation level', type: 'number', required: true, min: 1 },
      { name: 'levelName', label: 'Level name', type: 'text', required: true, maxLength: 120 },
      { name: 'escalationTimeInMinutes', label: 'Escalate after (minutes)', type: 'number', min: 0 },
      { name: 'escalateToEmail', label: 'Escalate to email', type: 'email', required: true },
    ],
    columns: [
      { name: 'levelName', label: 'Level' },
      { name: 'slaId', label: 'SLA ID' },
      { name: 'escalationTimeInMinutes', label: 'After (min)' },
      { name: 'escalateToEmail', label: 'Contact' },
    ],
    defaults: { slaId: '', level: '1', levelName: '', escalationTimeInMinutes: '0', escalateToEmail: '' },
  },
  emailTemplate: {
    title: 'Email templates',
    description: 'Maintain the subject and message body used by service notifications.',
    resource: 'emailTemplate',
    fields: [
      { name: 'name', label: 'Template name', type: 'text', required: true },
      { name: 'subjectTemplate', label: 'Subject template', type: 'text', required: true },
      { name: 'bodyTemplate', label: 'Email body', type: 'textarea', required: true },
      { name: 'isHtml', label: 'Body contains HTML', type: 'checkbox' },
    ],
    columns: [
      { name: 'name', label: 'Template' },
      { name: 'subjectTemplate', label: 'Subject' },
      { name: 'isHtml', label: 'Format', format: (row) => row.isHtml ? 'HTML' : 'Plain text' },
    ],
    defaults: { name: '', subjectTemplate: '', bodyTemplate: '', isHtml: false },
  },
  workOrderTemplate: {
    title: 'Work order templates',
    description: 'Create reusable request defaults for common maintenance and service work.',
    resource: 'workOrderTemplate',
    fields: [
      { name: 'name', label: 'Template name', type: 'text', required: true, maxLength: 200 },
      { name: 'category', label: 'Category', type: 'text', required: true },
      { name: 'subCategory', label: 'Subcategory', type: 'text' },
      { name: 'defaultDescription', label: 'Default description', type: 'textarea' },
      { name: 'defaultPriority', label: 'Default priority', type: 'select', options: [
        { value: '', label: 'No default' },
        { value: 'Low', label: 'Low' },
        { value: 'Medium', label: 'Medium' },
        { value: 'High', label: 'High' },
        { value: 'Critical', label: 'Critical' },
      ] },
      { name: 'defaultSLAId', label: 'Default SLA', type: 'select', options: [] },
      { name: 'isActive', label: 'Template is active', type: 'checkbox' },
    ],
    columns: [
      { name: 'name', label: 'Template' },
      { name: 'category', label: 'Category' },
      { name: 'defaultPriority', label: 'Priority' },
      { name: 'isActive', label: 'Status', format: (row) => row.isActive === false ? 'Inactive' : 'Active' },
    ],
    defaults: { name: '', category: '', subCategory: '', defaultDescription: '', defaultPriority: '', defaultSLAId: '', isActive: true },
  },
}

function toFormValue(value: unknown, field: ConfigField): string | boolean {
  if (field.type === 'checkbox') return value === true
  return value == null ? '' : String(value)
}

function makePayload(values: Record<string, string | boolean>, definition: ConfigDefinition, id: string | number | null): AdminRecord {
  const payload: AdminRecord = {}
  for (const field of definition.fields) {
    const value = values[field.name]
    if (field.type === 'checkbox') {
      payload[field.name] = value === true
    } else if (field.type === 'number') {
      payload[field.name] = value === '' ? null : Number(value)
    } else if (field.type === 'select' && value === '') {
      payload[field.name] = null
    } else {
      payload[field.name] = value === '' ? null : value
    }
  }
  if (definition.resource === 'emailTemplate' && id !== null) payload.id = Number(id)
  return payload
}

function formatCell(record: AdminRecord, column: ConfigDefinition['columns'][number]) {
  if (column.format) return column.format(record)
  const value = record[column.name]
  return value == null || value === '' ? '—' : String(value)
}

export default function AdminConfigPage({ resource }: { resource: AdminResource }) {
  const definition = definitions[resource]
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [editor, setEditor] = useState<{ id: string | number | null; values: Record<string, string | boolean> } | null>(null)
  const [ticketTemplate, setTicketTemplate] = useState<{ id: string | number; name: string } | null>(null)
  const [ticketValues, setTicketValues] = useState({
    reporterId: user?.id ?? '',
    ticketType: 'Work Order',
    titleOverride: '',
    descriptionOverride: '',
    priorityOverride: '',
    slaIdOverride: '',
  })
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const listQuery = useQuery({
    queryKey: ['admin-config', resource],
    queryFn: () => adminConfigApi.list(resource),
  })
  const slaQuery = useQuery({
    queryKey: ['admin-config', 'sla'],
    queryFn: () => adminConfigApi.list('sla'),
    enabled: resource === 'escalation' || resource === 'workOrderTemplate',
    staleTime: 5 * 60 * 1000,
  })
  const saveMutation = useMutation({
    mutationFn: async (data: { id: string | number | null; values: Record<string, string | boolean> }) => {
      const payload = makePayload(data.values, definition, data.id)
      return data.id === null
        ? adminConfigApi.create(resource, payload)
        : adminConfigApi.update(resource, data.id, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-config', resource] })
      setEditor(null)
      setErrorText('')
    },
    onError: (error) => setErrorText(getErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => adminConfigApi.remove(resource, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-config', resource] })
      setErrorText('')
    },
    onError: (error) => setErrorText(getErrorMessage(error)),
  })
  const createTicketMutation = useMutation({
    mutationFn: () => {
      if (!ticketTemplate) throw new Error('Select a work order template first.')
      if (!ticketValues.reporterId.trim()) throw new Error('A reporter ID is required.')
      return workOrderTemplatesApi.createTicket(ticketTemplate.id, {
        reporterId: ticketValues.reporterId.trim(),
        ticketType: ticketValues.ticketType,
        titleOverride: ticketValues.titleOverride.trim() || null,
        descriptionOverride: ticketValues.descriptionOverride.trim() || null,
        priorityOverride: ticketValues.priorityOverride || null,
        slaIdOverride: ticketValues.slaIdOverride ? Number(ticketValues.slaIdOverride) : null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setTicketTemplate(null)
      setSuccessText('Ticket created from the work order template.')
      setErrorText('')
    },
    onError: (error) => setErrorText(getErrorMessage(error)),
  })
  const testEmailMutation = useMutation({
    mutationFn: adminConfigApi.sendEscalationTestEmail,
    onSuccess: (response) => {
      const message = typeof response === 'string'
        ? response
        : response && typeof response === 'object' && 'message' in response
          ? String(response.message)
          : 'Test email request sent successfully.'
      setSuccessText(message)
      setErrorText('')
    },
    onError: (error) => setErrorText(getErrorMessage(error)),
  })

  const fields = definition.fields.map((field) => {
    if (field.name !== 'slaId' && field.name !== 'defaultSLAId') return field
    const options = (slaQuery.data ?? []).map((sla) => {
      const id = getRecordId(sla)
      const name = sla.name ?? sla.Name
      return id === null ? null : { value: String(id), label: String(name ?? `SLA ${id}`) }
    }).filter((option): option is { value: string; label: string } => option !== null)
    return { ...field, options: field.name === 'defaultSLAId' ? [{ value: '', label: 'No default' }, ...options] : options }
  })

  const startCreate = () => {
    setErrorText('')
    setSuccessText('')
    setEditor({ id: null, values: { ...definition.defaults } })
  }

  const startEdit = async (row: AdminRecord) => {
    const id = getRecordId(row)
    if (id === null) {
      setErrorText('This record is missing its ID and cannot be edited.')
      return
    }
    setErrorText('')
    try {
      const record = await adminConfigApi.get(resource, id)
      const values = Object.fromEntries(fields.map((field) => [
        field.name,
        toFormValue(record[field.name] ?? row[field.name], field),
      ]))
      setEditor({ id, values })
    } catch (error) {
      setErrorText(getErrorMessage(error))
    }
  }

  const updateValue = (name: string, value: string | boolean) => {
    setEditor((previous) => previous ? { ...previous, values: { ...previous.values, [name]: value } } : previous)
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editor) return
    if ((resource === 'escalation' || resource === 'workOrderTemplate') && slaQuery.isError) {
      setErrorText(getErrorMessage(slaQuery.error))
      return
    }
    saveMutation.mutate(editor)
  }

  return (
    <div className="page-enter space-y-5">
      <section className="dashboard-hero relative isolate overflow-hidden rounded-2xl border border-indigo-200/70 p-5 dark:border-indigo-400/15 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Service desk · Settings</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{definition.title}</h1>
            <p className="mt-1.5 text-sm text-subtle">{definition.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {resource === 'escalation' && <Button variant="outline" loading={testEmailMutation.isPending} onClick={() => testEmailMutation.mutate()}>Send test email</Button>}
            <Button onClick={startCreate}><Plus className="size-4" /> Add {resource === 'sla' ? 'SLA' : resource === 'escalation' ? 'level' : 'template'}</Button>
          </div>
        </div>
      </section>

      {errorText && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><CircleAlert className="mt-0.5 size-4 shrink-0" />{errorText}</div>}
      {successText && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{successText}</div>}
      {listQuery.isError && <Card className="flex items-center gap-3 p-5 text-sm text-red-700 dark:text-red-300"><CircleAlert className="size-5 shrink-0" />{getErrorMessage(listQuery.error)}<Button variant="outline" className="ml-auto" onClick={() => listQuery.refetch()}>Retry</Button></Card>}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><h2 className="font-semibold">Configured {definition.title.toLowerCase()}</h2><p className="mt-1 text-xs text-subtle">{listQuery.data?.length ?? 0} records</p></div>
          <Button variant="outline" onClick={() => listQuery.refetch()} title="Refresh"><RefreshCw className={`size-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} /></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-soft/70 text-[11px] uppercase tracking-wider text-subtle"><tr>{definition.columns.map((column) => <th key={column.name} className="px-4 py-3 font-semibold">{column.label}</th>)}<th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-line">
              {listQuery.isLoading && <tr><td colSpan={definition.columns.length + 1} className="px-4 py-12 text-center text-subtle"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Loading settings…</td></tr>}
              {listQuery.data?.map((row, index) => {
                const id = getRecordId(row)
                return <tr key={id ?? index} className="hover:bg-soft/40">
                  {definition.columns.map((column) => <td key={column.name} className="max-w-sm px-4 py-3"><span className="block truncate">{formatCell(row, column)}</span></td>)}
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">
                    {resource === 'workOrderTemplate' && id !== null && <Button variant="outline" className="px-3 py-2" disabled={row.isActive === false || row.IsActive === false} onClick={() => {
                      setTicketValues({ reporterId: user?.id ?? '', ticketType: 'Work Order', titleOverride: '', descriptionOverride: '', priorityOverride: '', slaIdOverride: '' })
                      setTicketTemplate({ id, name: String(row.name ?? row.Name ?? 'Work order') })
                      setErrorText('')
                    }} title="Create a ticket from this template"><Wrench className="size-4" />Create ticket</Button>}
                    <Button variant="outline" className="px-3 py-2" onClick={() => startEdit(row)} title="Edit"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" className="px-3 py-2" onClick={() => {
                      if (id === null) setErrorText('This record is missing its ID and cannot be deleted.')
                      else if (window.confirm(`Delete this ${definition.title.toLowerCase()} record?`)) deleteMutation.mutate(id)
                    }} title="Delete"><Trash2 className="size-4 text-red-500" /></Button>
                  </div></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        {!listQuery.isLoading && !listQuery.isError && !listQuery.data?.length && <div className="px-6 py-12 text-center text-sm text-subtle">No records configured yet. Add one to get started.</div>}
      </Card>

      {editor && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/45 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saveMutation.isPending) setEditor(null)
        }}>
          <Card className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="config-editor-title">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><h2 id="config-editor-title" className="text-lg font-semibold">{editor.id === null ? 'Add' : 'Edit'} {definition.title.replace(/s$/, '')}</h2><p className="mt-1 text-sm text-subtle">Changes are saved to the service configuration.</p></div>
              <button type="button" onClick={() => setEditor(null)} disabled={saveMutation.isPending} className="rounded-lg p-2 text-subtle hover:bg-soft" aria-label="Close"><X className="size-5" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => {
                  const value = editor.values[field.name]
                  if (field.type === 'checkbox') return <label key={field.name} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm font-medium sm:col-span-2">
                    <input type="checkbox" checked={value === true} onChange={(event) => updateValue(field.name, event.target.checked)} className="size-4 accent-indigo-600" />
                    {field.label}
                  </label>
                  if (field.type === 'textarea') return <div key={field.name} className="sm:col-span-2"><Field label={field.label}><textarea required={field.required} value={String(value ?? '')} onChange={(event) => updateValue(field.name, event.target.value)} rows={4} className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-subtle/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" /></Field></div>
                  if (field.type === 'select') return <Field key={field.name} label={field.label}>
                    <Select required={field.required} value={String(value ?? '')} onChange={(event) => updateValue(field.name, event.target.value)}>
                      {!field.required && !field.options?.some((option) => option.value === '') && <option value="">Select…</option>}
                      {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </Field>
                  return <Field key={field.name} label={field.label}>
                    <Input type={field.type} required={field.required} min={field.min} maxLength={field.maxLength} value={String(value ?? '')} onChange={(event) => updateValue(field.name, event.target.value)} />
                  </Field>
                })}
              </div>
              {resource === 'emailTemplate' && <p className="text-xs text-subtle">Template placeholders and merge fields are interpreted by the notification service.</p>}
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Button type="button" variant="outline" onClick={() => setEditor(null)} disabled={saveMutation.isPending}>Cancel</Button>
                <Button type="submit" loading={saveMutation.isPending}><Save className="size-4" />Save</Button>
              </div>
            </form>
          </Card>
        </div>,
        document.body,
      )}

      {ticketTemplate && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/45 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !createTicketMutation.isPending) setTicketTemplate(null)
        }}>
          <Card className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="template-ticket-title">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><h2 id="template-ticket-title" className="text-lg font-semibold">Create ticket from template</h2><p className="mt-1 text-sm text-subtle">{ticketTemplate.name}</p></div>
              <button type="button" onClick={() => setTicketTemplate(null)} disabled={createTicketMutation.isPending} className="rounded-lg p-2 text-subtle hover:bg-soft" aria-label="Close"><X className="size-5" /></button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); createTicketMutation.mutate() }} className="space-y-4">
              <Field label="Reporter ID *"><Input required value={ticketValues.reporterId} onChange={(event) => setTicketValues((previous) => ({ ...previous, reporterId: event.target.value }))} /></Field>
              <Field label="Ticket type *"><Select required value={ticketValues.ticketType} onChange={(event) => setTicketValues((previous) => ({ ...previous, ticketType: event.target.value }))}><option>Work Order</option><option>Service Request</option><option>Incident</option><option>ChangeRequest</option></Select></Field>
              <Field label="Title override"><Input value={ticketValues.titleOverride} onChange={(event) => setTicketValues((previous) => ({ ...previous, titleOverride: event.target.value }))} placeholder="Use template title if left blank" /></Field>
              <Field label="Description override"><textarea value={ticketValues.descriptionOverride} onChange={(event) => setTicketValues((previous) => ({ ...previous, descriptionOverride: event.target.value }))} rows={3} placeholder="Use template description if left blank" className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Priority override"><Select value={ticketValues.priorityOverride} onChange={(event) => setTicketValues((previous) => ({ ...previous, priorityOverride: event.target.value }))}><option value="">Use template default</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
                <Field label="SLA override"><Select value={ticketValues.slaIdOverride} onChange={(event) => setTicketValues((previous) => ({ ...previous, slaIdOverride: event.target.value }))}><option value="">Use template default</option>{slaQuery.data?.map((sla) => { const id = getRecordId(sla); return id === null ? null : <option key={id} value={id}>{String(sla.name ?? sla.Name ?? `SLA ${id}`)}</option> })}</Select></Field>
              </div>
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Button type="button" variant="outline" onClick={() => setTicketTemplate(null)} disabled={createTicketMutation.isPending}>Cancel</Button>
                <Button type="submit" loading={createTicketMutation.isPending}><Wrench className="size-4" />Create ticket</Button>
              </div>
            </form>
          </Card>
        </div>,
        document.body,
      )}
    </div>
  )
}

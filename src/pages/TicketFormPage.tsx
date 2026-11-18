import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ClipboardPlus, Mic, MicOff, Save, TriangleAlert } from 'lucide-react'
import { adminConfigApi } from '../api/adminConfig'
import { ticketsApi } from '../api/tickets'
import { devicesApi } from '../api/devices'
import { usersApi } from '../api/users'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, Field, Input, Select } from '../components/ui'
import { PRIORITIES, SEVERITIES } from '../lib/constants'
import { getErrorMessage } from '../lib/http'
import { extractTicketFields, type VoiceDeviceOption, type VoiceSlaOption } from '../lib/voiceTicketExtraction'
import type { CreateTicketPayload, Ticket } from '../types'

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

type FormState = {
  title: string
  description: string
  reporterId: string
  slaId: string
  category: string
  subCategory: string
  ticketType: string
  priority: string
  severity: string
  deviceId: string
  projectName: string
  landmark: string
}

const initialForm: FormState = {
  title: '', description: '', reporterId: '', slaId: '', category: '', subCategory: '',
  ticketType: 'Incident', priority: 'Medium', severity: 'Medium', deviceId: '', projectName: '', landmark: '',
}

const ticketTypeOptions = ['Incident', 'Service Request', 'Maintenance', 'ChangeRequest', 'Work Order']
const voiceSummaryLabels: Partial<Record<keyof FormState, string>> = {
  title: 'Title',
  category: 'Category',
  subCategory: 'Subcategory',
  ticketType: 'Ticket type',
  priority: 'Priority',
  severity: 'Severity',
  slaId: 'SLA Policy',
  deviceId: 'Device',
  projectName: 'Project',
  landmark: 'Location',
}

function fromTicket(ticket: Ticket): FormState {
  return {
    title: ticket.ticketTitle ?? '', description: ticket.description ?? '', reporterId: ticket.reporterId ?? '',
    slaId: ticket.slaId == null ? '' : String(ticket.slaId), category: ticket.category ?? '', subCategory: ticket.subCategory ?? '',
    ticketType: ticket.ticketType ?? 'Incident', priority: ticket.priority ?? 'Medium', severity: ticket.severity ?? 'Medium',
    deviceId: ticket.deviceId ?? '', projectName: ticket.projectName ?? '', landmark: ticket.landmark ?? '',
  }
}

export default function TicketFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const ticketId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [form, setForm] = useState<FormState>({ ...initialForm, reporterId: user?.id || user?.email || '' })
  const [formError, setFormError] = useState('')
  const [voiceLanguage, setVoiceLanguage] = useState('en-US')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [voiceConfirmation, setVoiceConfirmation] = useState<string[]>([])
  const [voiceExtractedSummary, setVoiceExtractedSummary] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [autoFilledFields, setAutoFilledFields] = useState<Set<keyof FormState>>(() => new Set())
  const manuallyEditedFieldsRef = useRef(new Set<keyof FormState>())
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalTranscriptRef = useRef('')
  const processedTranscriptRef = useRef('')
  const recognitionErrorRef = useRef(false)
  const extractionOptionsRef = useRef<{ slaOptions: VoiceSlaOption[]; deviceOptions: VoiceDeviceOption[] }>({
    slaOptions: [],
    deviceOptions: [],
  })

  const slaQuery = useQuery({
    queryKey: ['admin-config', 'sla'],
    queryFn: () => adminConfigApi.list('sla'),
    staleTime: 5 * 60 * 1000,
  })
  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.list(),
    staleTime: 1000 * 60 * 5,
  })
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: editing,
    staleTime: 1000 * 60 * 5,
  })

  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketsApi.get(ticketId),
    enabled: editing && Number.isFinite(ticketId),
  })

  useEffect(() => {
    if (ticketQuery.data) setForm(fromTicket(ticketQuery.data))
  }, [ticketQuery.data])

  const slaOptions: VoiceSlaOption[] = (slaQuery.data ?? []).flatMap((sla) => {
    const rawId = sla.id ?? sla.Id ?? sla.slaId ?? sla.SlaId ?? sla.slaPolicyId ?? sla.SlaPolicyId
    const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : ''
    const rawName = sla.name ?? sla.Name ?? sla.slaName ?? sla.SlaName ?? sla.policyName ?? sla.PolicyName ?? sla.slaPolicyName ?? sla.SlaPolicyName
    const name = typeof rawName === 'string' ? rawName.trim() : ''
    const rawDuration = sla.resolutionTimeInMinutes ?? sla.ResolutionTimeInMinutes
    const resolutionTimeInMinutes = typeof rawDuration === 'number'
      ? rawDuration
      : typeof rawDuration === 'string' && rawDuration.trim() ? Number(rawDuration) : undefined
    const isPlaceholderName = /^(string|null|undefined|sla name|policy name)$/i.test(name)
    const displayName = !isPlaceholderName && name
      ? name
      : ''
    return /^\d+$/.test(id) && Number(id) > 0 && displayName
      ? [{ id, name: displayName, ...(Number.isFinite(resolutionTimeInMinutes) ? { resolutionTimeInMinutes } : {}) }]
      : []
  })
  const voiceDeviceOptions: VoiceDeviceOption[] = (devicesQuery.data ?? []).map((device) => ({
    id: device.id,
    names: [device.shortName, device.longName, device.tagNumber, device.serialNumber].filter((value): value is string => Boolean(value?.trim())),
  }))
  extractionOptionsRef.current = { slaOptions, deviceOptions: voiceDeviceOptions }

  useEffect(() => () => {
    recognitionRef.current?.abort()
  }, [])

  const save = useMutation({
    mutationFn: (payload: CreateTicketPayload) => editing ? ticketsApi.update(ticketId, payload) : ticketsApi.create(payload),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
      await queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      const createdId = Number((result as { ticketId?: number } | null)?.ticketId ?? ticketId)
      navigate(editing ? `/tickets/${ticketId}` : Number.isFinite(createdId) && createdId > 0 ? `/tickets/${createdId}` : '/tickets')
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  })

  const change = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = event.target.value
    manuallyEditedFieldsRef.current.add(key)
    setForm((previous) => ({ ...previous, [key]: value }))
    setAutoFilledFields((previous) => {
      if (!previous.has(key)) return previous
      const next = new Set(previous)
      next.delete(key)
      return next
    })
    const summaryLabel = voiceSummaryLabels[key]
    if (summaryLabel) {
      setVoiceExtractedSummary((previous) => previous.filter((item) => !item.startsWith(`${summaryLabel}:`)))
    }
  }

  const processVoiceTranscript = (transcript: string) => {
    const normalizedTranscript = transcript.trim()
    if (!normalizedTranscript || normalizedTranscript === processedTranscriptRef.current) return
    processedTranscriptRef.current = normalizedTranscript
    setVoiceTranscript(normalizedTranscript)
    const extracted = extractTicketFields(normalizedTranscript, {
      ...extractionOptionsRef.current,
      priorityOptions: [...PRIORITIES],
      severityOptions: [...SEVERITIES],
      ticketTypeOptions,
    })
    const { confirmationRequired = [], ...fields } = extracted
    const detectedFields: Partial<FormState> = { ...fields, description: normalizedTranscript }
    const protectedFields = manuallyEditedFieldsRef.current
    const applicableFields = Object.fromEntries(
      Object.entries(detectedFields).filter(([key, value]) => value !== undefined && !protectedFields.has(key as keyof FormState)),
    ) as Partial<FormState>
    const updatedFields = Object.keys(applicableFields) as (keyof FormState)[]
    setForm((previous) => ({ ...previous, ...applicableFields }))
    setVoiceConfirmation(confirmationRequired)
    setAutoFilledFields((previous) => new Set([...previous, ...updatedFields]))

    const summary: string[] = []
    if (applicableFields.title) summary.push(`${voiceSummaryLabels.title}: ${applicableFields.title}`)
    if (applicableFields.category) summary.push(`${voiceSummaryLabels.category}: ${applicableFields.category}`)
    if (applicableFields.subCategory) summary.push(`${voiceSummaryLabels.subCategory}: ${applicableFields.subCategory}`)
    if (applicableFields.ticketType) summary.push(`${voiceSummaryLabels.ticketType}: ${applicableFields.ticketType}`)
    if (applicableFields.priority) summary.push(`${voiceSummaryLabels.priority}: ${applicableFields.priority}`)
    if (applicableFields.severity) summary.push(`${voiceSummaryLabels.severity}: ${applicableFields.severity}`)
    if (applicableFields.slaId) {
      const policy = extractionOptionsRef.current.slaOptions.find((option) => option.id === applicableFields.slaId)
      if (policy) summary.push(`${voiceSummaryLabels.slaId}: ${policy.name}`)
    }
    if (applicableFields.deviceId) {
      const device = extractionOptionsRef.current.deviceOptions.find((option) => option.id === applicableFields.deviceId)
      summary.push(`${voiceSummaryLabels.deviceId}: ${device?.names[0] || applicableFields.deviceId}`)
    }
    if (applicableFields.projectName) summary.push(`${voiceSummaryLabels.projectName}: ${applicableFields.projectName}`)
    if (applicableFields.landmark) summary.push(`${voiceSummaryLabels.landmark}: ${applicableFields.landmark}`)
    setVoiceExtractedSummary(summary)
  }

  const toggleVoiceInput = () => {
    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognition = (window as SpeechRecognitionWindow).SpeechRecognition
      ?? (window as SpeechRecognitionWindow).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. You can type the description instead.')
      return
    }

    const recognition = new SpeechRecognition()
    finalTranscriptRef.current = ''
    processedTranscriptRef.current = ''
    recognitionErrorRef.current = false
    setVoiceTranscript('')
    setVoiceExtractedSummary([])
    setVoiceConfirmation([])
    setVoiceError('')
    recognition.lang = voiceLanguage
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onstart = () => {
      setIsRecording(true)
      setVoiceError('')
    }
    recognition.onresult = (event) => {
      const results = Array.from(event.results)
      const fullTranscript = results.map((result) => result[0].transcript.trim()).filter(Boolean).join(' ')
      const finalTranscript = results.filter((result) => result.isFinal).map((result) => result[0].transcript.trim()).filter(Boolean).join(' ')
      setVoiceTranscript(fullTranscript)
      finalTranscriptRef.current = finalTranscript
    }
    recognition.onerror = (event) => {
      recognitionErrorRef.current = true
      setIsRecording(false)
      setVoiceError(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone access was denied. Allow microphone access in your browser settings, or type the description.'
        : `Voice input stopped (${event.error}). You can try again or type the description.`)
    }
    recognition.onend = () => {
      setIsRecording(false)
      recognitionRef.current = null
      if (finalTranscriptRef.current.trim()) {
        processVoiceTranscript(finalTranscriptRef.current)
      } else if (!recognitionErrorRef.current) {
        setVoiceError('No speech was recognized. Try again or enter the ticket details manually.')
      }
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setIsRecording(false)
      setVoiceError('Could not start voice input. Check microphone access and try again.')
    }
  }

  const fieldLabel = (label: string, field: keyof FormState) => (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span>{label}</span>
      {autoFilledFields.has(field) && <span className="text-[10px] font-medium normal-case tracking-normal text-brand">Auto-filled from voice</span>}
    </span>
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    const slaId = Number(form.slaId)
    if (!form.title.trim() || !form.description.trim() || !form.reporterId.trim() || !Number.isInteger(slaId) || slaId < 1) {
      setFormError('Title, description, reporter name, and an SLA policy are required.')
      return
    }
    const payload: CreateTicketPayload = {
      title: form.title.trim(), description: form.description.trim(),
      reporterId: (editing ? form.reporterId : user?.id || user?.email || form.reporterId).trim(), slaId,
      category: form.category.trim() || null, subCategory: form.subCategory.trim() || null,
      ticketType: form.ticketType || null, priority: form.priority || null, severity: form.severity || null,
      deviceId: form.deviceId.trim() || null, projectName: form.projectName.trim() || null,
      landmark: form.landmark.trim() || null, ticketSource: 'Manual',
    }
    save.mutate(payload)
  }

  if (editing && ticketQuery.isLoading) return <div className="page-enter py-20 text-center text-sm text-subtle">Loading ticket details…</div>
  if (editing && (ticketQuery.isError || !ticketQuery.data)) return (
    <Card className="page-enter mx-auto max-w-xl p-8 text-center">
      <TriangleAlert className="mx-auto size-8 text-amber-500" />
      <h1 className="mt-3 text-lg font-semibold">Could not open this ticket</h1>
      <p className="mt-1 text-sm text-subtle">{getErrorMessage(ticketQuery.error, 'Ticket not found.')}</p>
      <Link to="/tickets"><Button variant="outline" className="mt-5">Back to tickets</Button></Link>
    </Card>
  )

  return (
    <div className="page-enter mx-auto w-full max-w-none">
      <Link to={editing ? `/tickets/${ticketId}` : '/tickets'} className="inline-flex items-center gap-2 text-sm font-medium text-subtle transition hover:text-brand">
        <ArrowLeft className="size-4" /> {editing ? 'Back to ticket' : 'Back to tickets'}
      </Link>
      <div className="mt-2 flex items-start gap-3">
        <div className="sidebar-brand grid size-8 shrink-0 place-items-center rounded-xl text-white"><ClipboardPlus className="size-4" /></div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{editing ? 'Edit ticket' : 'Create a ticket'}</h1>
          <p className="mt-0.5 text-xs text-subtle">{editing ? 'Update the ticket details.' : 'Describe the issue or use voice to fill the form.'}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mx-auto mt-2 w-full space-y-2 lg:w-[94%]">
        {formError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><TriangleAlert className="mt-0.5 size-4 shrink-0" />{formError}</div>}
        {!editing && (
          <Card className="p-2.5 shadow-sm">
            <section aria-label="Voice input" className="grid items-stretch gap-2 md:grid-cols-[1fr_0.8fr]">
              <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-2 dark:border-indigo-400/20 dark:bg-indigo-500/5 md:flex-nowrap">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-brand dark:bg-indigo-500/15"><Mic className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold">Describe your issue</h2>
                  <p className="mt-0.5 text-xs text-subtle">{isRecording ? 'Listening… speak clearly, then stop recording.' : 'Describe the issue and mention priority, device, project, or location if relevant.'}</p>
                </div>
                <Select aria-label="Voice input language" className="!w-auto py-1.5 text-xs" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value)} disabled={isRecording}>
                  <option value="en-US">English</option>
                  <option value="hi-IN">Hindi</option>
                </Select>
                <Button type="button" variant={isRecording ? 'outline' : 'primary'} className="h-9 px-3 py-0 text-xs" onClick={toggleVoiceInput}>
                  {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  {isRecording ? 'Stop recording' : 'Start voice input'}
                </Button>
              </div>
              <div aria-live="polite" className="min-h-12 rounded-xl border border-indigo-100 bg-indigo-50/35 px-3 py-2 dark:border-indigo-400/15 dark:bg-indigo-500/5">
                <p className="flex items-center gap-2 text-xs font-medium text-brand"><Mic className="size-3.5" />Transcript preview</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-subtle">{voiceTranscript || 'Your spoken description will appear here.'}</p>
                {voiceExtractedSummary.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-indigo-100 pt-2 dark:border-indigo-400/15">
                    {voiceExtractedSummary.map((field) => (
                      <span key={field} className="rounded-lg bg-white/80 px-2 py-1 text-[11px] font-medium text-ink shadow-sm dark:bg-slate-900/50">
                        {field}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {(voiceError || voiceConfirmation.length > 0) && (
                <div className="sm:col-span-2">
                  {voiceError && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{voiceError}</p>}
                  {voiceConfirmation.length > 0 && <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-300">Please confirm {voiceConfirmation.map((field) => field === 'slaId' ? 'the SLA policy' : field).join(', ')} in the form. Voice matching was ambiguous or no matching configured option was found.</p>}
                </div>
              )}
            </section>
          </Card>
        )}
        <Card className="p-3 shadow-[0_12px_34px_-20px_rgba(79,70,229,0.3)] sm:p-3.5">
          {slaQuery.isError && (
            <div role="alert" className="mb-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />Could not load SLA policies: {getErrorMessage(slaQuery.error)}
            </div>
          )}
          {slaQuery.isSuccess && !slaOptions.length && (
            <p role="status" className="mb-1 text-xs text-amber-700 dark:text-amber-300">No usable SLA policies were returned by the server. Configure an SLA policy before creating a ticket.</p>
          )}
          <div className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label={fieldLabel('Title *', 'title')}><Input required maxLength={180} placeholder="Briefly describe the issue" value={form.title} onChange={change('title')} /></Field></div>
            <div className="sm:col-span-2"><Field label={fieldLabel('Description *', 'description')}><textarea required rows={2} maxLength={4000} placeholder="What happened? Include any useful troubleshooting details…" value={form.description} onChange={change('description')} className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-1.5 text-sm text-ink placeholder:text-subtle/70 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" /></Field></div>
            <Field label={fieldLabel('Category', 'category')}><Input placeholder="e.g. Hardware" value={form.category} onChange={change('category')} /></Field>
            <Field label={fieldLabel('Subcategory', 'subCategory')}><Input placeholder="e.g. Storage" value={form.subCategory} onChange={change('subCategory')} /></Field>
            <Field label="Ticket type"><Select value={form.ticketType} onChange={change('ticketType')}><option>Incident</option><option>Service Request</option><option>Maintenance</option><option>ChangeRequest</option><option>Work Order</option></Select></Field>
            <Field label={fieldLabel('SLA Policy *', 'slaId')}>
              <Select required value={form.slaId} onChange={change('slaId')} disabled={slaQuery.isLoading || slaOptions.length === 0}>
                <option value="">{slaQuery.isLoading ? 'Loading SLA policies…' : slaOptions.length ? 'Select an SLA policy' : 'No SLA policies available'}</option>
                {slaOptions.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}
              </Select>
            </Field>
            <Field label={fieldLabel('Priority', 'priority')}><Select value={form.priority} onChange={change('priority')}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
            <Field label={fieldLabel('Severity', 'severity')}><Select value={form.severity} onChange={change('severity')}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
            <div><Field label="Reporter name *">
              <Input
                required
                value={
                  form.reporterId === user?.id || form.reporterId === user?.email
                    ? user.name
                    : usersQuery.data?.find((entry) => entry.id === form.reporterId)?.email || form.reporterId
                }
                placeholder="Reporter name"
                disabled
              />
            </Field></div>
            <Field label="Device name (optional)" error={devicesQuery.isError ? getErrorMessage(devicesQuery.error) : undefined}>
              <Select value={form.deviceId} onChange={change('deviceId')} disabled={devicesQuery.isLoading || devicesQuery.isError}>
                <option value="">— None —</option>
                {form.deviceId && !devicesQuery.data?.some((device) => device.id === form.deviceId) && (
                  <option value={form.deviceId}>{form.deviceId}</option>
                )}
                {devicesQuery.data?.map((device) => {
                  const label = device.shortName?.trim() || device.longName?.trim() || device.tagNumber?.trim()
                    || device.serialNumber?.trim() || device.id
                  return <option key={device.id} value={device.id}>{label}</option>
                })}
              </Select>
            </Field>
            <Field label="Project name"><Input value={form.projectName} onChange={change('projectName')} placeholder="Project or site" /></Field>
            <Field label="Landmark"><Input value={form.landmark} onChange={change('landmark')} placeholder="Building, floor, or rack" /></Field>
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-line pt-2">
            <Link to={editing ? `/tickets/${ticketId}` : '/tickets'}><Button variant="outline">Cancel</Button></Link>
            <Button type="submit" loading={save.isPending} disabled={slaOptions.length === 0 || slaQuery.isLoading || slaQuery.isError}><Save className="size-4" />{editing ? 'Save changes' : 'Create Ticket'}</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}

import type { ReactNode } from 'react'
import { cx } from './ui'

const tones = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/25',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-400/25',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/25',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/25',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/25',
}
type Tone = keyof typeof tones

function Badge({ tone, dot = false, children }: { tone: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

const norm = (v?: string | null) => (v ?? '').toLowerCase().replace(/[\s_-]/g, '')

const statusTone: Record<string, Tone> = {
  open: 'blue',
  assigned: 'amber',
  inprogress: 'amber',
  escalated: 'red',
  approved: 'violet',
  rejected: 'rose',
  resolved: 'teal',
  closed: 'green',
}

export function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge tone={statusTone[norm(status)] ?? 'slate'} dot>
      {status || 'Unknown'}
    </Badge>
  )
}

const levelTone: Record<string, Tone> = { critical: 'red', high: 'orange', medium: 'amber', low: 'slate' }

export function LevelBadge({ level }: { level?: string | null }) {
  if (!level) return <span className="text-subtle">—</span>
  return <Badge tone={levelTone[norm(level)] ?? 'slate'}>{level}</Badge>
}

const sourceTone: Record<string, Tone> = {
  manual: 'slate',
  autofromalert: 'violet',
  automatic: 'violet',
  emailfallback: 'blue',
}

export function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return <span className="text-subtle">—</span>
  return <Badge tone={sourceTone[norm(source)] ?? 'slate'}>{source}</Badge>
}

export function SlaBadge({ breached, status }: { breached?: boolean; status?: string | null }) {
  if (breached) return <Badge tone="red">Breached</Badge>
  const done = ['resolved', 'closed'].includes(norm(status))
  return <Badge tone={done ? 'green' : 'slate'}>{done ? 'Met' : 'On track'}</Badge>
}

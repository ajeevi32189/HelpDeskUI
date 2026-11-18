// Server dates may include a 7-digit fractional second (.9037815); truncate it to 3 digits for safe parsing.
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.replace(/(\.\d{3})\d+/, '$1'))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

import type { ComponentProps, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-[#4f46e5] to-[#2563eb] text-white shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-600/25',
  outline: 'border border-line bg-surface text-ink shadow-sm hover:border-brand/30 hover:bg-brand/5',
  ghost: 'text-subtle hover:bg-soft hover:text-ink',
  danger: 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-red-600/20 hover:brightness-105',
}

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Field({ label, error, children }: { label?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
      {children}
      {error && <span className="mt-1.5 block text-xs text-red-500">{error}</span>}
    </label>
  )
}

const control =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-subtle/70 ' +
  'shadow-sm shadow-slate-900/[0.02] transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export function Input({ icon, className, ...rest }: ComponentProps<'input'> & { icon?: ReactNode }) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle">{icon}</span>}
      <input {...rest} className={cx(control, !!icon && 'pl-10', className)} />
    </div>
  )
}

export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return <select {...rest} className={cx(control, 'cursor-pointer py-2', className)} />
}

export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return <div {...rest} className={cx('rounded-2xl border border-line/90 bg-surface shadow-[0_8px_30px_-18px_rgba(15,23,42,0.22)]', className)} />
}

import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Headset, Lock, Moon, ShieldCheck, Sun, Ticket, Timer, TriangleAlert, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Captcha } from '../components/Captcha'
import { SupportAgentFigure } from '../components/SupportAgentFigure'
import { Button, Field, Input } from '../components/ui'
import { getErrorMessage } from '../lib/http'
import { useTheme } from '../theme/ThemeProvider'

const schema = z.object({
  username: z.string().min(1, 'Enter your email or username.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  captchaValue: z.string().min(1, 'Enter the CAPTCHA.'),
})
type FormValues = z.infer<typeof schema>

const features = [
  { icon: Ticket, title: 'Ticket tracking', text: 'Track every ticket from incident report to resolution.' },
  { icon: Timer, title: 'SLA & Escalation', text: 'Get alerts before a deadline is missed.' },
  { icon: ShieldCheck, title: 'Complete audit trail', text: 'Keep a record of every action and who performed it.' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/tickets'

  const [captchaKey, setCaptchaKey] = useState('')
  const [reload, setReload] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (user) return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await login({ ...values, captchaKey })
      navigate(from, { replace: true })
    } catch (e) {
      setError(getErrorMessage(e, 'Sign-in failed. Please try again.'))
      resetField('captchaValue')
      setReload((n) => n + 1)
    }
  })

  return (
    <div className="grid min-h-screen xl:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden overflow-hidden border-r border-indigo-100 bg-gradient-to-br from-white via-[#f8f9ff] to-[#edf2ff] p-10 text-slate-900 dark:border-slate-700 dark:from-slate-950 dark:via-slate-900 dark:to-[#171a34] xl:flex xl:flex-col xl:justify-between 2xl:p-14">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 size-[28rem] rounded-full bg-blue-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="sidebar-brand grid size-11 place-items-center rounded-xl text-white">
            <Headset className="size-6" />
          </div>
          <span className="text-xl font-semibold tracking-tight dark:text-white">Ajeevi HelpDesk</span>
        </div>
        <div className="relative grid items-center gap-5 2xl:grid-cols-[0.86fr_1.14fr]">
          <div className="max-w-md">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Helpdesk management</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight dark:text-white 2xl:text-5xl">IT support,<br /><span className="text-brand">without the chaos.</span></h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">Manage tickets, SLAs, escalations, and reports—all in one simple workspace for your support team.</p>
          </div>
          <SupportAgentFigure className="mx-auto h-[250px] w-full min-w-0 max-w-[440px] sm:h-[280px] 2xl:h-[320px] 2xl:max-w-[480px]" />
          <ul className="col-span-full grid gap-4 border-t border-indigo-200/70 pt-5 dark:border-slate-700 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-100 text-brand dark:bg-indigo-500/15">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold dark:text-white">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} Ajeevi Technologies</p>
      </div>

      {/* Right: form */}
      <div className="relative flex items-center justify-center bg-white p-6 dark:bg-slate-950 lg:bg-[#fbfbfd] dark:lg:bg-slate-950">
        <button
          type="button"
          onClick={toggle}
          title="Toggle theme"
          className="absolute right-5 top-5 rounded-lg border border-line bg-surface p-2.5 text-subtle transition hover:text-ink"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-[0_18px_60px_rgba(24,36,59,0.08)] sm:p-8">
          <div className="mb-8 lg:hidden">
            <div className="grid size-11 place-items-center rounded-xl bg-brand text-brand-ink">
              <Headset className="size-6" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back 👋</h2>
          <p className="mb-8 mt-1.5 text-sm text-subtle">Sign in to your account.</p>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <Field label="Email / Username" error={errors.username?.message}>
              <Input icon={<User className="size-4" />} autoComplete="username" placeholder="you@company.com" {...register('username')} />
            </Field>

            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <Input
                  icon={<Lock className="size-4" />}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-3 text-subtle hover:text-ink"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <div>
              <span className="mb-1.5 block text-sm font-medium">Captcha</span>
              <Captcha reloadKey={reload} onKey={setCaptchaKey} />
              <div className="mt-2">
                <Field error={errors.captchaValue?.message}>
                  <Input autoComplete="off" placeholder="Enter the text shown above (case-insensitive)." {...register('captchaValue')} />
                </Field>
              </div>
            </div>
          </div>

          <Button type="submit" loading={isSubmitting} disabled={!captchaKey} className="mt-7 w-full py-2.5">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}

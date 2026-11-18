import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Bell, BellRing, CircleHelp, ClipboardList, Headset, LayoutDashboard, LogOut, Mail, Menu, Moon,
  ShieldCheck, Sun, Ticket, Timer, Users, X, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { cx } from '../components/ui'
import { ticketsApi } from '../api/tickets'
import { fmtDate } from '../lib/format'
import { getErrorMessage } from '../lib/http'
import { useTheme } from '../theme/ThemeProvider'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  show?: boolean
}

export default function AppLayout() {
  const { user, isAdmin, hasRole, can, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notificationsQuery = useQuery({
    queryKey: ['header-notifications'],
    queryFn: () => ticketsApi.list({ page: 1, pageSize: 10 }),
  })

  const main: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/tickets', label: 'Tickets', icon: Ticket },
    { to: '/reports', label: 'Reports', icon: BarChart3, show: hasRole('Admin', 'Manager', 'Approver') },
    { to: '/faq', label: 'FAQ & Support', icon: CircleHelp },
  ]
  const admin: NavItem[] = [
    { to: '/admin/sla', label: 'SLA', icon: Timer, show: isAdmin },
    { to: '/admin/escalation', label: 'Escalation Matrix', icon: BellRing, show: isAdmin },
    { to: '/admin/work-order-templates', label: 'Work Order Templates', icon: ClipboardList, show: isAdmin },
    { to: '/admin/email-templates', label: 'Email Templates', icon: Mail, show: isAdmin },
    { to: '/admin/users', label: 'Users', icon: Users, show: can('user.read') },
    { to: '/admin/roles', label: 'Roles & Permissions', icon: ShieldCheck, show: can('role.read') },
  ]

  const renderGroup = (title: string | null, items: NavItem[]) => {
    const visible = items.filter((i) => i.show !== false)
    if (!visible.length) return null
    return (
      <div className="mb-6">
        {title && !isSidebarCollapsed && <p className="sidebar-muted mb-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em]">{title}</p>}
        <ul className="space-y-1">
          {visible.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => setOpen(false)}
                aria-label={label}
                className={({ isActive }) =>
                  cx(
                    'flex items-center rounded-lg py-2 text-xs font-medium transition',
                    isSidebarCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                    isActive ? 'sidebar-link-active' : 'sidebar-link-idle',
                  )
                }
                title={isSidebarCollapsed ? label : undefined}
              >
                <Icon className="size-4 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const initial = (user?.name ?? 'U').charAt(0).toUpperCase()
  const recentUpdates = [...(notificationsQuery.data?.items ?? [])]
    .sort((a, b) => new Date(b.updatedAt ?? b.incidentLoggedOn ?? b.incidentOn ?? 0).getTime() - new Date(a.updatedAt ?? a.incidentLoggedOn ?? a.incidentOn ?? 0).getTime())
    .slice(0, 5)

  return (
    <div className="app-shell min-h-screen lg:flex">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cx(
          'sidebar-panel app-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isSidebarCollapsed && 'is-collapsed',
        )}
      >
        <div className={cx('flex h-16 shrink-0 items-center border-b border-white/10', isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <div className={cx('flex min-w-0 items-center', isSidebarCollapsed ? 'justify-center' : 'gap-2.5')}>
            <div className="sidebar-brand grid size-8 shrink-0 place-items-center rounded-lg text-white">
              <Headset className="size-[18px]" />
            </div>
            {!isSidebarCollapsed && <span className="truncate text-sm font-semibold tracking-tight text-white">Ajeevi HelpDesk</span>}
          </div>
          <button type="button" className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X className="size-5" />
          </button>
        </div>
        <nav className={cx('min-h-0 flex-1 overflow-y-auto py-4', isSidebarCollapsed ? 'px-2' : 'px-2.5')}>
          {renderGroup(null, main)}
          {renderGroup('Settings', admin)}
        </nav>
        <footer className={cx('mt-auto shrink-0 border-t border-white/10 bg-transparent py-3', isSidebarCollapsed ? 'px-2' : 'px-2.5')}>
          <div className={cx('relative', isSidebarCollapsed ? 'flex justify-center' : '')}>
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              title={isSidebarCollapsed ? user?.name ?? 'Profile' : undefined}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              className={cx(
                'flex items-center rounded-lg text-left transition hover:bg-white/10',
                isSidebarCollapsed ? 'w-9 justify-center p-1' : 'w-full gap-2.5 px-1.5 py-2',
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/20 bg-gradient-to-br from-indigo-500 to-blue-500 text-sm font-semibold text-white">
                {initial}
              </span>
              {!isSidebarCollapsed && (
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-xs font-semibold text-white">{user?.email ?? user?.name ?? 'User'}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-400">{user?.roles[0] ?? 'Support team'}</span>
                </span>
              )}
            </button>
            {profileOpen && (
              <div className={cx(
                'absolute bottom-full z-50 mb-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl',
                'left-0',
              )}>
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">{user?.email ?? user?.name ?? 'User'}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{user?.roles[0] ?? 'Support team'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setProfileOpen(false); void onLogout() }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </footer>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-4 shadow-[0_2px_12px_rgba(24,36,59,0.03)] backdrop-blur lg:px-8">
          <button type="button" className="rounded-lg p-2 text-subtle hover:bg-soft lg:hidden" onClick={() => { setIsSidebarCollapsed(false); setOpen(true) }} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isSidebarCollapsed}
            className="hidden rounded-lg p-2.5 text-subtle transition hover:bg-soft hover:text-brand lg:inline-flex"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((value) => !value)}
                title="Recent ticket updates"
                aria-label="Recent ticket updates"
                aria-expanded={notificationsOpen}
                className="relative rounded-lg p-2.5 text-subtle transition hover:bg-soft hover:text-ink"
              >
                <Bell className="size-[18px]" />
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                  <div className="border-b border-line px-4 py-3">
                    <p className="text-sm font-semibold">Recent ticket updates</p>
                    <p className="mt-0.5 text-xs text-subtle">Latest activity from your helpdesk</p>
                  </div>
                  {notificationsQuery.isLoading ? (
                    <p className="px-4 py-5 text-sm text-subtle">Loading updates…</p>
                  ) : notificationsQuery.isError ? (
                    <p role="alert" className="px-4 py-5 text-sm text-red-600">{getErrorMessage(notificationsQuery.error)}</p>
                  ) : recentUpdates.length ? (
                    <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                      {recentUpdates.map((ticket) => (
                        <li key={ticket.ticketId}>
                          <Link
                            to={`/tickets/${ticket.ticketId}`}
                            onClick={() => setNotificationsOpen(false)}
                            className="block px-4 py-3 transition hover:bg-soft"
                          >
                            <span className="block truncate text-sm font-medium">{ticket.ticketTitle}</span>
                            <span className="mt-1 flex items-center justify-between gap-2 text-xs text-subtle">
                              <span className="truncate">{ticket.status} · #{ticket.ticketId}</span>
                              <span className="shrink-0">{fmtDate(ticket.updatedAt ?? ticket.incidentLoggedOn ?? ticket.incidentOn)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-5 text-sm text-subtle">No ticket updates yet.</p>
                  )}
                  <Link to="/tickets" onClick={() => setNotificationsOpen(false)} className="block border-t border-line px-4 py-3 text-center text-xs font-semibold text-brand hover:bg-soft">
                    View all tickets
                  </Link>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggle}
              title="Toggle theme"
              className="rounded-lg p-2.5 text-subtle transition hover:bg-soft hover:text-ink"
            >
              {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>
          </div>
        </header>

        <main className="mx-auto min-w-0 max-w-[1600px] p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, RefreshCw, ShieldCheck } from 'lucide-react'
import { usersApi } from '../api/users'
import { Button, Card } from '../components/ui'
import { getErrorMessage } from '../lib/http'

export default function RolesPage() {
  const query = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list(), staleTime: 5 * 60 * 1000 })
  const roles = useMemo(() => {
    const counts = new Map<string, number>()
    for (const user of query.data ?? []) {
      for (const role of user.roles ?? []) counts.set(role, (counts.get(role) ?? 0) + 1)
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [query.data])

  return (
    <div className="page-enter space-y-5">
      <section className="dashboard-hero relative isolate overflow-hidden rounded-2xl border border-indigo-200/70 p-5 dark:border-indigo-400/15 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Administration · Access</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Roles &amp; Permissions</h1><p className="mt-1.5 text-sm text-subtle">Role assignments reported by the user directory.</p></div>
          <div className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand"><ShieldCheck className="size-5" /></div>
        </div>
      </section>
      <Card className="flex items-start gap-3 border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-900 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-100">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>This view is read-only. The supplied API exposes user role assignments, but no role or permission management endpoints.</p>
      </Card>
      {query.isError && <Card className="flex items-center gap-3 border-red-200 p-4 text-sm text-red-700 dark:border-red-500/30 dark:text-red-300"><CircleAlert className="size-5 shrink-0" />{getErrorMessage(query.error)}<Button variant="outline" className="ml-auto" onClick={() => query.refetch()}>Retry</Button></Card>}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">Assigned roles</h2><p className="mt-1 text-xs text-subtle">{roles.length} role(s) found · {query.data?.length ?? 0} directory users</p></div><Button variant="outline" onClick={() => query.refetch()} title="Refresh"><RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-soft/70 text-[11px] uppercase tracking-wider text-subtle"><tr><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Assigned users</th><th className="px-4 py-3 font-semibold">Access rules</th></tr></thead><tbody className="divide-y divide-line">
          {query.isLoading && <tr><td colSpan={3} className="px-4 py-12 text-center text-subtle">Loading role directory…</td></tr>}
          {roles.map(([role, count]) => <tr key={role} className="hover:bg-soft/40"><td className="px-4 py-3"><span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">{role}</span></td><td className="px-4 py-3 font-medium tabular-nums">{count}</td><td className="px-4 py-3 text-subtle">Permission details are not exposed by this API.</td></tr>)}
        </tbody></table></div>
        {!query.isLoading && !query.isError && !roles.length && <p className="px-6 py-12 text-center text-sm text-subtle">No user roles were returned by the directory.</p>}
      </Card>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { CircleAlert, RefreshCw, Users } from 'lucide-react'
import { usersApi } from '../api/users'
import { Button, Card, Input } from '../components/ui'
import { getErrorMessage } from '../lib/http'
import { useMemo, useState } from 'react'

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const query = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list(), staleTime: 5 * 60 * 1000 })
  const rows = useMemo(() => (query.data ?? []).filter((user) =>
    `${user.email ?? ''} ${user.roles?.join(' ') ?? ''} ${user.id}`.toLowerCase().includes(search.toLowerCase()),
  ), [query.data, search])

  return (
    <div className="page-enter space-y-5">
      <section className="dashboard-hero relative isolate overflow-hidden rounded-2xl border border-indigo-200/70 p-5 dark:border-indigo-400/15 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Administration · Directory</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Users</h1><p className="mt-1.5 text-sm text-subtle">View registered accounts and their assigned roles.</p></div>
          <div className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand"><Users className="size-5" /></div>
        </div>
      </section>
      {query.isError && <Card className="flex items-center gap-3 border-red-200 p-4 text-sm text-red-700 dark:border-red-500/30 dark:text-red-300"><CircleAlert className="size-5 shrink-0" />{getErrorMessage(query.error)}<Button variant="outline" className="ml-auto" onClick={() => query.refetch()}>Retry</Button></Card>}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <Input className="max-w-md" placeholder="Search users by email or role…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="flex items-center gap-3"><span className="text-xs text-subtle">{rows.length} users</span><Button variant="outline" title="Refresh" onClick={() => query.refetch()}><RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-soft/70 text-[11px] uppercase tracking-wider text-subtle"><tr><th className="px-4 py-3 font-semibold">Account</th><th className="px-4 py-3 font-semibold">User ID</th><th className="px-4 py-3 font-semibold">Roles</th></tr></thead>
            <tbody className="divide-y divide-line">
              {query.isLoading && <tr><td colSpan={3} className="px-4 py-12 text-center text-subtle">Loading users…</td></tr>}
              {rows.map((user) => <tr key={user.id} className="hover:bg-soft/40"><td className="px-4 py-3 font-medium">{user.email || '—'}</td><td className="px-4 py-3 font-mono text-xs text-subtle">{user.id}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{user.roles?.length ? user.roles.map((role) => <span key={role} className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">{role}</span>) : <span className="text-subtle">No roles listed</span>}</div></td></tr>)}
            </tbody>
          </table>
        </div>
        {!query.isLoading && !query.isError && !rows.length && <p className="px-6 py-12 text-center text-sm text-subtle">No users match this search.</p>}
      </Card>
    </div>
  )
}

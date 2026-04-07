import { createServiceRoleSupabase } from '@/lib/supabase/server'
import { CASE_STATUSES, formatCaseStatus, isCaseStatus } from '@/lib/case-status'
import { resolveCaseDisplayStatus } from '@/lib/resolve-case-display-status'

import { DashboardCasesTable } from './table'

type DashboardPageProps = {
  searchParams: Promise<{
    q?: string
    status?: string
  }>
}

function getStatusClasses(status: string | null) {
  if (status === 'new') return 'bg-blue-100 text-blue-800'
  if (status === 'received') return 'bg-cyan-100 text-cyan-800'
  if (status === 'in_progress') return 'bg-yellow-100 text-yellow-800'
  if (status === 'cremated') return 'bg-orange-100 text-orange-800'
  if (status === 'ready_for_return') return 'bg-indigo-100 text-indigo-800'
  if (status === 'on_hold') return 'bg-amber-100 text-amber-800'

  return 'bg-gray-100 text-gray-800'
}

const ACTIVE_CASE_STATUSES = CASE_STATUSES.filter(
  (status) => status !== 'completed' && status !== 'cancelled'
)

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const searchQuery = params.q?.trim() ?? ''
  const selectedStatus = params.status && isCaseStatus(params.status) ? params.status : ''

  const supabase = createServiceRoleSupabase()

  let query = supabase
    .from('cases')
    .select('id, case_number, pet_name, owner_name, clinic_name, status, created_at')
    .is('archived_at', null)
    .not('status', 'in', '("completed","cancelled")')
    .order('created_at', { ascending: false })

  if (selectedStatus) {
    query = query.eq('status', selectedStatus)
  }

  if (searchQuery) {
    const escapedSearchQuery = searchQuery.replace(/[%_,]/g, '\\$&')
    query = query.or(
      `case_number.ilike.%${escapedSearchQuery}%,pet_name.ilike.%${escapedSearchQuery}%,owner_name.ilike.%${escapedSearchQuery}%`
    )
  }

  const { data: cases, error } = await query

  if (error) {
    return (
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Active Cases Dashboard
          </h1>
          <p className="mt-3 text-xl text-slate-500">Unable to load dashboard.</p>
        </div>
    )
  }

  const rows =
    cases?.map((caseItem) => {
      const displayedStatus = resolveCaseDisplayStatus(caseItem.status, null)

      return {
        id: caseItem.id,
        href: `/cases/${caseItem.id}`,
        caseNumber: caseItem.case_number || '—',
        petName: caseItem.pet_name || '—',
        ownerName: caseItem.owner_name || '—',
        clinicName: caseItem.clinic_name || '—',
        status: formatCaseStatus(displayedStatus),
        statusClasses: getStatusClasses(displayedStatus),
        createdAt: caseItem.created_at
          ? new Date(caseItem.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
      }
    }) ?? []

  return (
    <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Active Cases Dashboard
        </h1>
        <p className="mt-3 text-xl text-slate-500">
          Active cases only. Search by case number, pet name, or owner name.
        </p>

        <form className="mt-8 grid gap-4 rounded-[28px] bg-white p-6 shadow-sm md:grid-cols-[1fr_260px_auto]">
          <div>
            <label htmlFor="q" className="mb-2 block text-sm font-medium text-slate-600">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={searchQuery}
              placeholder="Search case number, pet name, or owner name"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="status" className="mb-2 block text-sm font-medium text-slate-600">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={selectedStatus}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            >
              <option value="">All Active Statuses</option>
              {ACTIVE_CASE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatCaseStatus(status)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="rounded-xl bg-emerald-900 px-5 py-3 font-medium text-white hover:bg-emerald-800"
            >
              Apply
            </button>
            <a
              href="/dashboard"
              className="rounded-xl bg-slate-200 px-5 py-3 font-medium text-slate-900 hover:bg-slate-300"
            >
              Reset
            </a>
          </div>
        </form>

        <div className="mt-8 overflow-hidden rounded-[28px] bg-white shadow-sm">
          <DashboardCasesTable rows={rows} />
        </div>
    </div>
  )
}

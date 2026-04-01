import Link from 'next/link'

import { getUserRole } from '@/lib/auth/get-user-role'
import { formatCaseStatus } from '@/lib/case-status'
import { resolveCaseDisplayStatus } from '@/lib/resolve-case-display-status'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type CaseRow = {
  id: string
  case_number: string | null
  pet_name: string | null
  owner_name: string | null
  status: string | null
  created_at: string | null
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

export default async function ClinicPage() {
  const userRole = await getUserRole()

  if (!userRole || userRole.role !== 'clinic_user') {
    throw new Error('Clinic context is required')
  }

  const supabase = createServiceRoleSupabase()

  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('id, case_number, pet_name, owner_name, status, created_at')
    .eq('clinic_id', userRole.clinicId)
    .not('status', 'in', '("completed","cancelled")')
    .order('created_at', { ascending: false })

  if (casesError) {
    throw new Error('Unable to load clinic dashboard')
  }

  const openCases = ((cases as CaseRow[] | null) ?? []).map((caseItem) => {
    const displayedStatus = resolveCaseDisplayStatus(caseItem.status, null)

    return {
      ...caseItem,
      displayedStatus,
    }
  })

  const readyForReturnCount = openCases.filter(
    (caseItem) => caseItem.displayedStatus === 'ready_for_return'
  ).length
  const onHoldCount = openCases.filter(
    (caseItem) => caseItem.displayedStatus === 'on_hold'
  ).length
  const newCaseCount = openCases.filter(
    (caseItem) => caseItem.displayedStatus === 'new'
  ).length

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Clinic Dashboard
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Open work at a glance
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-slate-500">
          Review active cases for {userRole.clinicName}, start a new work order, and keep
          your team aligned on current aftercare status.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] bg-[#f4f7f5] p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Open Cases
            </div>
            <div className="mt-3 text-4xl font-bold text-slate-900">{openCases.length}</div>
          </div>
          <div className="rounded-[22px] bg-[#f6f5fb] p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ready for Return
            </div>
            <div className="mt-3 text-4xl font-bold text-slate-900">{readyForReturnCount}</div>
          </div>
          <div className="rounded-[22px] bg-[#fbf8ef] p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              On Hold
            </div>
            <div className="mt-3 text-4xl font-bold text-slate-900">{onHoldCount}</div>
          </div>
          <div className="rounded-[22px] bg-[#eef6fb] p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              New Work Orders
            </div>
            <div className="mt-3 text-4xl font-bold text-slate-900">{newCaseCount}</div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Open Cases
            </div>
            <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Current active cases
            </h3>
          </div>
          <p className="text-base text-slate-500">
            Non-terminal cases for {userRole.clinicName}
          </p>
        </div>

        {openCases.length === 0 ? (
          <div className="mt-8 rounded-[22px] bg-slate-50 px-6 py-8 text-lg text-slate-600">
            No open cases are currently assigned to this clinic.
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-[22px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Case Number</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pet Name</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Owner Name</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                      Current Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openCases.map((caseItem) => (
                    <tr key={caseItem.id} className="border-t border-slate-200">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        <Link href={`/cases/${caseItem.id}`} className="hover:underline">
                          {caseItem.case_number || '—'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {caseItem.pet_name || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {caseItem.owner_name || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`rounded-full px-3 py-1 font-medium ${getStatusClasses(caseItem.displayedStatus)}`}
                        >
                          {formatCaseStatus(caseItem.displayedStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

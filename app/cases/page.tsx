import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ClinicAccessBlocked } from '@/app/components/clinic-access-blocked'
import { ClinicPortalFrame } from '@/app/components/clinic-portal-frame'
import { InternalPortalFrame } from '@/app/components/internal-portal-frame'
import { getUserRole } from '@/lib/auth/get-user-role'
import { formatCaseStatus } from '@/lib/case-status'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { resolveCaseDisplayStatus } from '@/lib/resolve-case-display-status'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type CaseRow = {
  id: string
  case_number: string | null
  pet_name: string | null
  owner_name: string | null
  clinic_name: string | null
  status: string | null
  created_at: string | null
}

type CaseEventRow = {
  case_id: string
  event_type: string
  created_at: string
}

function getStatusClasses(status: string | null) {
  if (status === 'new') return 'bg-blue-100 text-blue-800'
  if (status === 'received') return 'bg-cyan-100 text-cyan-800'
  if (status === 'in_progress') return 'bg-yellow-100 text-yellow-800'
  if (status === 'cremated') return 'bg-orange-100 text-orange-800'
  if (status === 'ready_for_return') return 'bg-indigo-100 text-indigo-800'
  if (status === 'completed') return 'bg-green-100 text-green-800'
  if (status === 'on_hold') return 'bg-amber-100 text-amber-800'
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800'

  return 'bg-gray-100 text-gray-800'
}

export default async function CasesPage() {
  const userRole = await getUserRole()

  if (!userRole) {
    redirect('/clinic/login')
  }

  const isClinicUser = userRole.role === 'clinic_user'
  let clinicContext:
    | {
        clinicName: string
        clinicLogoPath: string | null
      }
    | null = null

  if (isClinicUser) {
    const clinicResult = await getClinicContextResult()

    if (!clinicResult) {
      redirect('/clinic/login')
    }

    if (clinicResult.kind === 'blocked') {
      return <ClinicAccessBlocked message={clinicResult.message} />
    }

    clinicContext = {
      clinicName: clinicResult.clinic.clinicName,
      clinicLogoPath: clinicResult.clinic.clinicLogoPath,
    }
  }

  const supabase = createServiceRoleSupabase()

  let query = supabase
    .from('cases')
    .select('id, case_number, pet_name, owner_name, clinic_name, status, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (isClinicUser) {
    query = query.eq('clinic_id', userRole.clinicId)
  }

  const { data: cases, error } = await query

  if (error) {
    const errorContent = (
      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Cases
          </h1>
          <p className="mt-3 text-xl text-slate-500">Unable to load cases.</p>
        </div>
      </section>
    )

    if (clinicContext) {
      return (
        <ClinicPortalFrame
          clinicName={clinicContext.clinicName}
          clinicLogoPath={clinicContext.clinicLogoPath}
        >
          {errorContent}
        </ClinicPortalFrame>
      )
    }

    return <InternalPortalFrame>{errorContent}</InternalPortalFrame>
  }

  const caseRows = (cases as CaseRow[] | null) ?? []
  const caseIds = caseRows.map((caseItem) => caseItem.id)
  let latestEventsByCaseId = new Map<string, CaseEventRow[]>()

  if (caseIds.length > 0) {
    const { data: caseEvents } = await supabase
      .from('case_events')
      .select('case_id, event_type, created_at')
      .in('case_id', caseIds)
      .order('created_at', { ascending: false })

    latestEventsByCaseId = new Map(
      caseIds.map((caseId) => [
        caseId,
        ((caseEvents as CaseEventRow[] | null) ?? []).filter((event) => event.case_id === caseId),
      ])
    )
  }

  const rows = caseRows.map((caseItem) => {
    const displayedStatus = resolveCaseDisplayStatus(
      caseItem.status,
      latestEventsByCaseId.get(caseItem.id)
    )

    return {
      ...caseItem,
      displayedStatus,
    }
  })

  const pageContent = (
    <section className="rounded-[28px] bg-white p-8 shadow-sm">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Cases
        </h1>
        <p className="mt-3 text-xl text-slate-500">
          {isClinicUser ? 'Your clinic cases.' : 'View and manage saved cases.'}
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-[22px] border border-slate-200">
        {rows.length === 0 ? (
          <div className="p-6">
            <p className="text-lg text-slate-600">No cases found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Case Number</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pet Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Owner Name</th>
                  {!isClinicUser ? (
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Clinic</th>
                  ) : null}
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                    Displayed Status
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((caseItem) => (
                  <tr key={caseItem.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      <Link href={`/cases/${caseItem.id}`} className="hover:underline">
                        {caseItem.case_number || '—'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{caseItem.pet_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {caseItem.owner_name || '—'}
                    </td>
                    {!isClinicUser ? (
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {caseItem.clinic_name || '—'}
                      </td>
                    ) : null}
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`rounded-full px-3 py-1 font-medium ${getStatusClasses(caseItem.displayedStatus)}`}
                      >
                        {formatCaseStatus(caseItem.displayedStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {caseItem.created_at
                        ? new Date(caseItem.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )

  if (clinicContext) {
    return (
      <ClinicPortalFrame
        clinicName={clinicContext.clinicName}
        clinicLogoPath={clinicContext.clinicLogoPath}
      >
        {pageContent}
      </ClinicPortalFrame>
    )
  }

  return <InternalPortalFrame>{pageContent}</InternalPortalFrame>
}

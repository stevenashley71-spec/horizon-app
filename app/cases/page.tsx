import { createServerSupabase } from '@/lib/supabase/server'
import { formatCaseStatus } from '@/lib/case-status'
import { resolveCaseDisplayStatus } from '@/lib/resolve-case-display-status'
import Link from 'next/link'

type CaseEventRow = {
  case_id: string
  event_type: string
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
  const supabase = createServerSupabase()

  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Cases
          </h1>
          <p className="mt-3 text-xl text-slate-500">Error loading cases: {error.message}</p>
        </div>
      </main>
    )
  }

  const caseIds = cases?.map((caseItem) => caseItem.id) ?? []
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
        ((caseEvents as Array<CaseEventRow & { created_at: string }> | null) ?? []).filter(
          (event) => event.case_id === caseId
        ),
      ])
    )
  }

  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Cases
        </h1>
        <p className="mt-3 text-xl text-slate-500">
          View and manage saved cases.
        </p>

        <div className="mt-8 space-y-4">
          {cases?.map((caseItem) => {
            const displayedStatus = resolveCaseDisplayStatus(
              caseItem.status,
              latestEventsByCaseId.get(caseItem.id)
            )

            return (
              <Link key={caseItem.id} href={`/cases/${caseItem.id}`}>
                <div className="rounded-[28px] bg-white p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div></div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusClasses(displayedStatus)}`}
                  >
                    {formatCaseStatus(displayedStatus)}
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-7">
                  <div>
                    <div className="text-sm font-medium text-slate-500">Case Number</div>
                    <div className="text-lg font-semibold text-slate-900">{caseItem.case_number}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Pet Name</div>
                    <div className="text-lg font-semibold text-slate-900">{caseItem.pet_name}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Owner Name</div>
                    <div className="text-lg font-semibold text-slate-900">{caseItem.owner_name}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Clinic</div>
                    <div className="text-lg font-semibold text-slate-900">{caseItem.clinic_name || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Cremation Type</div>
                    <div className="text-lg font-semibold text-slate-900">{caseItem.cremation_type || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Total</div>
                    <div className="text-lg font-semibold text-slate-900">{caseItem.total ? `$${caseItem.total.toFixed(2)}` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Created</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {new Date(caseItem.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </div>
              </Link>
            )
          })}
          {(!cases || cases.length === 0) && (
            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <p className="text-lg text-slate-600">No cases found.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

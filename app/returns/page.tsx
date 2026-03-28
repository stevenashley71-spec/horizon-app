import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import { updateCaseStatus } from '@/app/actions/update-case-status'
import { formatCaseStatus } from '@/lib/case-status'
import { resolveCaseDisplayStatus } from '@/lib/resolve-case-display-status'
import { createServerSupabase } from '@/lib/supabase/server'

type ReadyForReturnHistoryRow = {
  case_id: string
  changed_at: string
}

type CaseEventRow = {
  case_id: string
  event_type: string
}

function getStatusClasses(status: string | null) {
  if (status === 'ready_for_return') return 'bg-indigo-100 text-indigo-800'

  return 'bg-gray-100 text-gray-800'
}

export default async function ReturnsPage() {
  const supabase = createServerSupabase()

  const { data: cases, error } = await supabase
    .from('cases')
    .select('id, case_number, pet_name, owner_name, clinic_name, status, created_at')
    .eq('status', 'ready_for_return')
    .order('created_at', { ascending: true })

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Ready for Return Queue
          </h1>
          <p className="mt-3 text-xl text-slate-500">Error loading queue: {error.message}</p>
        </div>
      </main>
    )
  }

  const caseIds = cases?.map((caseItem) => caseItem.id) ?? []

  let readyHistoryByCaseId = new Map<string, string>()
  let latestEventsByCaseId = new Map<string, CaseEventRow[]>()

  if (caseIds.length > 0) {
    const { data: readyHistory, error: readyHistoryError } = await supabase
      .from('case_status_history')
      .select('case_id, changed_at')
      .in('case_id', caseIds)
      .eq('new_status', 'ready_for_return')
      .order('changed_at', { ascending: false })

    if (readyHistoryError) {
      return (
        <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Ready for Return Queue
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              Error loading ready-for-return history: {readyHistoryError.message}
            </p>
          </div>
        </main>
      )
    }

    readyHistoryByCaseId = new Map(
      ((readyHistory as ReadyForReturnHistoryRow[] | null) ?? [])
        .filter((row, index, rows) => rows.findIndex((item) => item.case_id === row.case_id) === index)
        .map((row) => [row.case_id, row.changed_at])
    )

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
          Ready for Return Queue
        </h1>
        <p className="mt-3 text-xl text-slate-500">
          Cases currently ready to go back to the clinic or owner.
        </p>

        <div className="mt-8 overflow-hidden rounded-[28px] bg-white shadow-sm">
          {!cases || cases.length === 0 ? (
            <div className="p-6">
              <p className="text-lg text-slate-600">No cases are currently ready for return.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Case Number</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pet Name</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Owner Name</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Clinic</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ready Since</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((caseItem) => {
                    // Fall back to created_at only if the ready_for_return history row is unavailable.
                    const readySince = readyHistoryByCaseId.get(caseItem.id) ?? caseItem.created_at
                    const displayedStatus = resolveCaseDisplayStatus(
                      caseItem.status,
                      latestEventsByCaseId.get(caseItem.id)
                    )

                    return (
                      <tr key={caseItem.id} className="border-t border-slate-200 align-top">
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
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {caseItem.clinic_name || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`rounded-full px-3 py-1 font-medium ${getStatusClasses(displayedStatus)}`}
                          >
                            {formatCaseStatus(displayedStatus)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {readySince
                            ? new Date(readySince).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              href={`/cases/${caseItem.id}`}
                              className="rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-900 hover:bg-slate-300"
                            >
                              View Case
                            </Link>
                            <form
                              action={async () => {
                                'use server'
                                await updateCaseStatus(caseItem.id, 'completed')
                                revalidatePath('/returns')
                              }}
                            >
                              <button
                                type="submit"
                                className="rounded-lg bg-emerald-900 px-4 py-2 font-medium text-white hover:bg-emerald-800"
                              >
                                Mark Returned
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

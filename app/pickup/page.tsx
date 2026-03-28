import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import { addCaseEvent } from '@/app/actions/add-case-event'
import { CASE_EVENT_TYPES } from '@/lib/case-events'
import { createServerSupabase } from '@/lib/supabase/server'

type PickupEventRow = {
  case_id: string
  event_type: string
}

export default async function PickupPage() {
  const supabase = createServerSupabase()

  const { data: cases, error } = await supabase
    .from('cases')
    .select('id, case_number, pet_name, owner_name, clinic_name, status, created_at')
    .not('status', 'in', '("completed","cancelled")')
    .order('created_at', { ascending: true })

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Clinic Pickup Queue
          </h1>
          <p className="mt-3 text-xl text-slate-500">Error loading pickup queue: {error.message}</p>
        </div>
      </main>
    )
  }

  const caseIds = cases?.map((caseItem) => caseItem.id) ?? []
  let pickedUpCaseIds = new Set<string>()
  let receivedCaseIds = new Set<string>()

  if (caseIds.length > 0) {
    const { data: pickupEvents, error: pickupEventsError } = await supabase
      .from('case_events')
      .select('case_id, event_type')
      .in('case_id', caseIds)
      .in('event_type', [
        CASE_EVENT_TYPES.PICKED_UP,
        CASE_EVENT_TYPES.RECEIVED_AT_FACILITY,
      ])

    if (pickupEventsError) {
      return (
        <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Clinic Pickup Queue
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              Error loading pickup events: {pickupEventsError.message}
            </p>
          </div>
        </main>
      )
    }

    pickedUpCaseIds = new Set(
      ((pickupEvents as PickupEventRow[] | null) ?? [])
        .filter((event) => event.event_type === CASE_EVENT_TYPES.PICKED_UP)
        .map((event) => event.case_id)
    )

    receivedCaseIds = new Set(
      ((pickupEvents as PickupEventRow[] | null) ?? [])
        .filter((event) => event.event_type === CASE_EVENT_TYPES.RECEIVED_AT_FACILITY)
        .map((event) => event.case_id)
    )
  }

  const queueCases = (cases ?? []).filter(
    (caseItem) => !pickedUpCaseIds.has(caseItem.id) && !receivedCaseIds.has(caseItem.id)
  )
  const clinicGroups = new Map<string, typeof queueCases>()

  for (const caseItem of queueCases) {
    const clinicName = caseItem.clinic_name?.trim() || 'Unknown Clinic'
    const existingGroup = clinicGroups.get(clinicName) ?? []
    existingGroup.push(caseItem)
    clinicGroups.set(clinicName, existingGroup)
  }

  const sortedClinicGroups = Array.from(clinicGroups.entries())
    .map(([clinicName, clinicCases]) => [
      clinicName,
      [...clinicCases].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return aTime - bTime
      }),
    ] as const)
    .sort(([clinicA], [clinicB]) => clinicA.localeCompare(clinicB))

  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Clinic Pickup Queue
        </h1>
        <p className="mt-3 text-xl text-slate-500">
          Active clinic cases that have not yet been picked up by Horizon.
        </p>

        <div className="mt-8 overflow-hidden rounded-[28px] bg-white shadow-sm">
          {queueCases.length === 0 ? (
            <div className="p-6">
              <p className="text-lg text-slate-600">
                No clinic cases are currently waiting for pickup.
              </p>
            </div>
          ) : (
            <div className="space-y-8 p-6">
              {sortedClinicGroups.map(([clinicName, clinicCases]) => (
                <section key={clinicName} className="overflow-hidden rounded-[24px] border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                    <h2 className="text-2xl font-semibold text-slate-900">{clinicName}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-slate-50">
                        <tr className="text-left">
                          <th className="px-6 py-4 text-sm font-semibold text-slate-600">Case Number</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pet Name</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-600">Owner Name</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-600">Clinic</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-600">Created</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clinicCases.map((caseItem) => (
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
                              {caseItem.clinic_name || 'Unknown Clinic'}
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
                                    await addCaseEvent(caseItem.id, CASE_EVENT_TYPES.PICKED_UP)
                                    revalidatePath('/pickup')
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className="rounded-lg bg-emerald-900 px-4 py-2 font-medium text-white hover:bg-emerald-800"
                                  >
                                    Mark Picked Up
                                  </button>
                                </form>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { validateClinicExitPinForClinic } from '@/app/actions/validate-clinic-exit-pin'
import { getUserRole } from '@/lib/auth/get-user-role'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type SubmittedCaseSummary = {
  id: string
  clinic_id: string | null
  case_number: string | null
  clinic_name: string | null
  pet_weight: string | number | null
  pet_weight_unit: string | null
  pet_name: string | null
  pet_species: string | null
  pet_breed: string | null
  pet_color: string | null
  owner_name: string | null
  owner_phone: string | null
  owner_address: string | null
  owner_city: string | null
  owner_state: string | null
  owner_zip: string | null
  cremation_type: string | null
  subtotal: number | null
  case_data: {
    formNumber?: string
  } | null
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function formatWeight(caseItem: {
  pet_weight?: string | number | null
  pet_weight_unit?: string | null
}) {
  if (!caseItem.pet_weight || !caseItem.pet_weight_unit) {
    return '—'
  }

  return `${caseItem.pet_weight} ${caseItem.pet_weight_unit}`
}

function formatAddress(caseItem: {
  owner_address?: string | null
  owner_city?: string | null
  owner_state?: string | null
  owner_zip?: string | null
}) {
  return [
    caseItem.owner_address,
    caseItem.owner_city,
    caseItem.owner_state,
    caseItem.owner_zip,
  ]
    .filter(Boolean)
    .join(', ')
}

function formatCurrency(value: number | null) {
  return typeof value === 'number' ? `$${value.toFixed(2)}` : '—'
}

export default async function ClinicSubmittedCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pin?: string; error?: string; target?: string }>
}) {
  const userRole = await getUserRole()

  if (!userRole) {
    redirect('/clinic/login')
  }

  if (userRole.role !== 'clinic_user') {
    redirect('/dashboard')
  }

  const { id } = await params
  const resolvedSearchParams = await searchParams

  if (!id || !isUuidLike(id)) {
    notFound()
  }

  async function handleDashboardUnlock(formData: FormData) {
    'use server'

    const enteredPin = String(formData.get('exit_pin') ?? '')
    const target = String(formData.get('target') ?? '')
    const isValid = typedCaseItem.clinic_id
      ? await validateClinicExitPinForClinic(typedCaseItem.clinic_id, enteredPin)
      : false

    if (isValid) {
      if (target === 'cases') {
        redirect('/cases')
      }

      redirect('/clinic')
    }

    const nextTarget = target === 'cases' ? 'cases' : 'dashboard'
    redirect(`/clinic/submitted/${id}?pin=1&target=${nextTarget}&error=1`)
  }

  const supabase = createServiceRoleSupabase()
  const { data: caseItem, error: caseError } = await supabase
    .from('cases')
    .select(
      'id, clinic_id, case_number, clinic_name, pet_weight, pet_weight_unit, pet_name, pet_species, pet_breed, pet_color, owner_name, owner_phone, owner_address, owner_city, owner_state, owner_zip, cremation_type, subtotal, case_data'
    )
    .eq('id', id)
    .single()

  if (caseError) {
    const isNoRowsError =
      caseError.message.includes('No rows') || caseError.code === 'PGRST116'

    if (!isNoRowsError) {
      throw new Error('Unable to load submitted case summary')
    }
  }

  if (!caseItem) {
    notFound()
  }

  const typedCaseItem = caseItem as SubmittedCaseSummary

  if (typedCaseItem.clinic_id !== userRole.clinicId) {
    notFound()
  }

  const isPinPromptOpen = resolvedSearchParams.pin === '1'
  const allowedTargets = new Set(['dashboard', 'cases'])

  const rawTarget =
    typeof resolvedSearchParams?.target === 'string'
      ? resolvedSearchParams.target
      : undefined

  const target = allowedTargets.has(rawTarget ?? '') ? rawTarget : 'dashboard'
  const pendingTarget = target
  const error = resolvedSearchParams.error === '1' ? 'Incorrect PIN' : ''

  return (
    <>
      {isPinPromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6 py-8">
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Exit Intake</h2>
            <p className="mt-3 text-base text-slate-500">
              Enter the clinic PIN to leave the submitted summary and return to the dashboard.
            </p>

            <form action={handleDashboardUnlock} className="mt-6">
              <label className="mb-3 block text-xl font-semibold text-slate-900">PIN</label>
              <input name="target" type="hidden" value={pendingTarget} />
              <input
                name="exit_pin"
                type="password"
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                placeholder="Enter PIN"
              />

              {error ? (
                <p className="mt-4 text-base text-rose-700">{error}</p>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-4">
                <Link
                  href={`/clinic/submitted/${id}`}
                  className="rounded-[18px] bg-slate-200 px-6 py-3 text-lg font-medium text-slate-900 transition-colors hover:bg-slate-300"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="rounded-[18px] bg-emerald-900 px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-emerald-800"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="space-y-8">
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Review Summary
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Review Summary
          </h2>
          <p className="mt-3 max-w-3xl text-lg text-slate-500">
            Please review the work order before signing.
          </p>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h3 className="text-2xl font-semibold text-slate-900">Work Order</h3>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-slate-500">Form #</div>
                <div className="text-lg font-semibold text-slate-900">
                  {typedCaseItem.case_data?.formNumber || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Clinic</div>
                <div className="text-lg font-semibold text-slate-900">
                  {typedCaseItem.clinic_name || userRole.clinicName || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Pet Name</div>
                <div className="text-lg font-semibold text-slate-900">
                  {typedCaseItem.pet_name || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Pet Weight</div>
                <div className="text-lg font-semibold text-slate-900">
                  {formatWeight(typedCaseItem)}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-sm font-medium text-slate-500">
                  Pet Species / Breed / Color
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {[
                    typedCaseItem.pet_species,
                    typedCaseItem.pet_breed,
                    typedCaseItem.pet_color,
                  ]
                    .filter(Boolean)
                    .join(' / ') || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Owner Name</div>
                <div className="text-lg font-semibold text-slate-900">
                  {typedCaseItem.owner_name || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Phone</div>
                <div className="text-lg font-semibold text-slate-900">
                  {typedCaseItem.owner_phone || '—'}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-sm font-medium text-slate-500">Address</div>
                <div className="text-lg font-semibold text-slate-900">
                  {formatAddress(typedCaseItem) || '—'}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-sm font-medium text-slate-500">Cremation Type</div>
                <div className="text-lg font-semibold text-slate-900">
                  {typedCaseItem.cremation_type || '—'}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h3 className="text-2xl font-semibold text-slate-900">Client Charges</h3>

            <div className="mt-6 space-y-5">
              <div className="rounded-[22px] border border-slate-200 p-5">
                <div className="text-sm font-medium text-slate-500">
                  {typedCaseItem.cremation_type === 'general'
                    ? 'General Cremation'
                    : typedCaseItem.cremation_type === 'private'
                      ? 'Private Cremation'
                      : 'Cremation'}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">—</div>
              </div>

              <div className="rounded-[22px] bg-slate-900 px-6 py-5 text-white">
                <div className="text-sm font-medium text-slate-300">Total</div>
                <div className="mt-2 text-3xl font-bold">
                  {formatCurrency(typedCaseItem.subtotal)}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href={`/clinic/submitted/${id}?pin=1&target=cases`}
              className="inline-flex items-center justify-center rounded-[18px] bg-slate-200 px-6 py-3 text-lg font-medium text-slate-900 transition-colors hover:bg-slate-300"
            >
              Back to Cases
            </Link>
            <Link
              href={`/clinic/submitted/${id}?pin=1&target=dashboard`}
              className="inline-flex items-center justify-center rounded-[18px] bg-emerald-900 px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-emerald-800"
            >
              Dashboard
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}

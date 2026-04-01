import { redirect } from 'next/navigation'

import { setClinicActive } from '@/app/actions/admin-clinics'
import { AdminSectionShell } from '../admin-section-shell'
import { ClinicForm } from './clinic-form'
import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServerSupabase } from '@/lib/supabase/server'

type ClinicRow = {
  id: string
  name: string
  code: string | null
  pickup_verification_code: string | null
  delivery_verification_code: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email: string | null
  logo_path: string | null
  logo_alt_text: string | null
  is_active: boolean
}

async function getLogoUrl(logoPath: string | null) {
  if (!logoPath) {
    return null
  }

  const supabase = await createServerSupabase()
  const { data } = supabase.storage.from('clinic-logos').getPublicUrl(logoPath)
  return data.publicUrl
}

export default async function ClinicsAdminPage() {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    redirect('/admin/login')
  }

  if (adminResult.kind === 'blocked') {
    return (
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Clinics Admin
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            {adminResult.message}
          </p>
        </div>
    )
  }

  const supabase = await createServerSupabase()
  const { data: clinics, error } = await supabase
    .from('clinics')
    .select(
      'id, name, code, pickup_verification_code, delivery_verification_code, address_line_1, address_line_2, city, state, zip, phone, email, logo_path, logo_alt_text, is_active'
    )
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const clinicItems = await Promise.all(
    ((clinics as ClinicRow[] | null) ?? []).map(async (clinic) => ({
      ...clinic,
      logo_url: await getLogoUrl(clinic.logo_path),
    }))
  )

  return (
    <AdminSectionShell>
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Clinics Admin
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              Manage clinic records, activation, and clinic branding.
            </p>
          </div>
        </section>

        <ClinicForm />

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Existing Clinics</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update clinic details, manage branding, or change active status.
            </p>
          </div>

          {clinicItems.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-slate-600">No clinics have been created yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {clinicItems.map((clinic) => (
                <div key={clinic.id} className="space-y-4">
                  <div className="flex justify-end">
                    <form
                      action={async () => {
                        'use server'
                        await setClinicActive(clinic.id, !clinic.is_active)
                      }}
                    >
                      <button
                        type="submit"
                        className={`rounded-lg px-4 py-2 font-medium ${
                          clinic.is_active
                            ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                            : 'bg-emerald-900 text-white hover:bg-emerald-800'
                        }`}
                      >
                        {clinic.is_active ? 'Deactivate Clinic' : 'Activate Clinic'}
                      </button>
                    </form>
                  </div>
                  <ClinicForm clinic={clinic} />
                </div>
              ))}
            </div>
          )}
        </section>
    </AdminSectionShell>
  )
}

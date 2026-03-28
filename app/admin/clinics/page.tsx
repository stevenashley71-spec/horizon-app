import Link from 'next/link'

import { setClinicActive } from '@/app/actions/admin-clinics'
import { ClinicForm } from '@/app/admin/clinics/clinic-form'
import { isHorizonAdmin } from '@/lib/horizon-admin'
import { createServerSupabase } from '@/lib/supabase/server'

type ClinicRow = {
  id: string
  name: string
  code: string | null
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

function getLogoUrl(logoPath: string | null) {
  if (!logoPath) {
    return null
  }

  const supabase = createServerSupabase()
  const { data } = supabase.storage.from('clinic-logos').getPublicUrl(logoPath)
  return data.publicUrl
}

export default async function ClinicsAdminPage() {
  if (!isHorizonAdmin()) {
    return (
      <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Clinics Admin
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            Horizon Admin access is required.
          </p>
        </div>
      </main>
    )
  }

  const supabase = createServerSupabase()
  const { data: clinics, error } = await supabase
    .from('clinics')
    .select(
      'id, name, code, address_line_1, address_line_2, city, state, zip, phone, email, logo_path, logo_alt_text, is_active'
    )
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const clinicItems = ((clinics as ClinicRow[] | null) ?? []).map((clinic) => ({
    ...clinic,
    logo_url: getLogoUrl(clinic.logo_path),
  }))

  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Clinics Admin
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              Manage clinic records, activation, and clinic branding.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-900 hover:bg-slate-300"
          >
            Back Home
          </Link>
        </div>

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
      </div>
    </main>
  )
}

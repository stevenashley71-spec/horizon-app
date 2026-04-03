import Link from 'next/link'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'

import { AdminSectionShell } from '../admin-section-shell'
import { ClinicAccordionList } from './clinic-accordion-list'
import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server'

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

type ClinicUserRow = {
  clinic_id: string
  user_id: string
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

  const supabase = createServiceRoleSupabase()
  const [{ data: clinics, error }, { data: clinicUsers, error: clinicUsersError }, usersResponse] =
    await Promise.all([
      supabase
        .from('clinics')
        .select(
          'id, name, code, pickup_verification_code, delivery_verification_code, address_line_1, address_line_2, city, state, zip, phone, email, logo_path, logo_alt_text, is_active'
        )
        .order('name', { ascending: true }),
      supabase
        .from('clinic_users')
        .select('clinic_id, user_id'),
      supabase.auth.admin.listUsers(),
    ])

  if (error) {
    throw new Error(error.message)
  }

  if (clinicUsersError) {
    throw new Error(clinicUsersError.message)
  }

  if (usersResponse.error) {
    throw new Error(usersResponse.error.message)
  }

  const clinicUserItems = (clinicUsers as ClinicUserRow[] | null) ?? []
  const userEmailMap = new Map(
    (usersResponse.data.users ?? []).map((user) => [user.id, user.email ?? null])
  )

  const clinicItems = await Promise.all(
    ((clinics as ClinicRow[] | null) ?? []).map(async (clinic) => ({
      ...clinic,
      logo_url: await getLogoUrl(clinic.logo_path),
      pickup_qr: clinic.pickup_verification_code
        ? await QRCode.toDataURL(clinic.pickup_verification_code)
        : null,
      delivery_qr: clinic.delivery_verification_code
        ? await QRCode.toDataURL(clinic.delivery_verification_code)
        : null,
      linked_users: clinicUserItems
        .filter((clinicUser) => clinicUser.clinic_id === clinic.id)
        .map((clinicUser) => ({
          user_id: clinicUser.user_id,
          email: userEmailMap.get(clinicUser.user_id) ?? null,
        })),
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
            <div className="mt-6">
              <Link
                href="/admin/clinics/new"
                className="inline-flex rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
              >
                Create New Clinic
              </Link>
            </div>
          </div>
        </section>

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
            <ClinicAccordionList clinicItems={clinicItems} />
          )}
        </section>
    </AdminSectionShell>
  )
}

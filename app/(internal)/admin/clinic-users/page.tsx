import { redirect } from 'next/navigation'

import { AdminSectionShell } from '../admin-section-shell'
import { ClinicUserForm } from './clinic-user-form'

import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type ClinicRow = {
  id: string
  name: string
  is_active: boolean
}

type ClinicUserRow = {
  clinic_id: string
  user_id: string
}

export default async function AdminClinicUsersPage() {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    redirect('/admin/login')
  }

  if (adminResult.kind === 'blocked') {
    return (
        <div className="mx-auto max-w-4xl rounded-[28px] bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Horizon Admin Access Blocked
          </h1>
          <p className="mt-3 text-lg text-slate-500">{adminResult.message}</p>
        </div>
    )
  }

  const supabase = createServiceRoleSupabase()
  const [{ data: clinics, error: clinicsError }, { data: clinicUsers, error: clinicUsersError }, usersResponse] =
    await Promise.all([
      supabase
        .from('clinics')
        .select('id, name, is_active')
        .order('name', { ascending: true }),
      supabase
        .from('clinic_users')
        .select('clinic_id, user_id'),
      supabase.auth.admin.listUsers(),
    ])

  if (clinicsError) {
    throw new Error(clinicsError.message)
  }

  if (clinicUsersError) {
    throw new Error(clinicUsersError.message)
  }

  if (usersResponse.error) {
    throw new Error(usersResponse.error.message)
  }

  const clinicItems = (clinics as ClinicRow[] | null) ?? []
  const clinicUserItems = (clinicUsers as ClinicUserRow[] | null) ?? []
  const userEmailMap = new Map(
    (usersResponse.data.users ?? []).map((user) => [user.id, user.email ?? 'Unknown email'])
  )

  const clinicAssignments = clinicItems.map((clinic) => {
    const linkedUsers = clinicUserItems
      .filter((clinicUser) => clinicUser.clinic_id === clinic.id)
      .map((clinicUser) => userEmailMap.get(clinicUser.user_id) ?? 'Unknown email')

    return {
      ...clinic,
      linkedUsers,
    }
  })

  return (
    <AdminSectionShell>
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Clinic User Management
          </h1>
          <p className="mt-3 text-lg text-slate-500">
            Signed in as {adminResult.admin.email}. Create temporary clinic logins for internal testing.
          </p>
        </section>

        <ClinicUserForm clinics={clinicItems.map((clinic) => ({ id: clinic.id, name: clinic.name }))} />

        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Clinics</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="text-left text-sm font-semibold text-slate-600">
                  <th className="pb-3 pr-6">Clinic</th>
                  <th className="pb-3 pr-6">Status</th>
                  <th className="pb-3">Linked Clinic Logins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clinicAssignments.map((clinic) => (
                  <tr key={clinic.id} className="align-top">
                    <td className="py-4 pr-6 text-slate-900">{clinic.name}</td>
                    <td className="py-4 pr-6">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          clinic.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {clinic.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 text-slate-700">
                      {clinic.linkedUsers.length > 0 ? clinic.linkedUsers.join(', ') : 'No clinic login linked yet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
    </AdminSectionShell>
  )
}

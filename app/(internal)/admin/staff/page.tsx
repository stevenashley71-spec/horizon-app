import { redirect } from 'next/navigation'

import {
  createHorizonStaffAdmin,
  deleteHorizonStaffAdmin,
  saveHorizonNotificationSettingsAdmin,
} from '@/app/actions/admin-horizon-users'
import { AdminSectionShell } from '../admin-section-shell'
import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type HorizonUserRow = {
  user_id: string
  role: 'admin' | 'horizon_staff'
  is_active: boolean
}

type HorizonSettingsRow = {
  id: boolean
  notification_email: string | null
  notification_sms_phone: string | null
}

export default async function StaffAdminPage() {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    redirect('/admin/login')
  }

  if (adminResult.kind === 'blocked') {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Staff Admin
        </h1>
        <p className="mt-3 text-xl text-slate-500">{adminResult.message}</p>
      </div>
    )
  }

  const supabase = createServiceRoleSupabase()
  const [
    { data: horizonUsers, error: horizonUsersError },
    usersResponse,
    { data: horizonSettings, error: horizonSettingsError },
  ] = await Promise.all([
    supabase
      .from('horizon_users')
      .select('user_id, role, is_active')
      .order('role', { ascending: true }),
    supabase.auth.admin.listUsers(),
    supabase
      .from('horizon_settings')
      .select('id, notification_email, notification_sms_phone')
      .eq('id', true)
      .maybeSingle(),
  ])

  if (horizonUsersError) {
    throw new Error(horizonUsersError.message)
  }

  if (usersResponse.error) {
    throw new Error(usersResponse.error.message)
  }

  if (horizonSettingsError) {
    throw new Error(horizonSettingsError.message)
  }

  const userEmailMap = new Map(
    (usersResponse.data.users ?? []).map((user) => [user.id, user.email ?? null])
  )
  const horizonUserItems = ((horizonUsers as HorizonUserRow[] | null) ?? []).map((user) => ({
    ...user,
    email: userEmailMap.get(user.user_id) ?? null,
  }))
  const typedHorizonSettings = (horizonSettings as HorizonSettingsRow | null) ?? null

  return (
    <AdminSectionShell>
      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Staff Admin
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            Create and remove Horizon Staff users for internal access.
          </p>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Notification Routing</h2>
          <p className="mt-1 text-sm text-slate-500">
            Set the operational destination for clinic-submitted new case alerts. SMS is stored
            here for future use only.
          </p>
        </div>

        <form
          action={saveHorizonNotificationSettingsAdmin}
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Notification Email
            </label>
            <input
              name="notification_email"
              type="email"
              defaultValue={typedHorizonSettings?.notification_email ?? ''}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Internal SMS Notification Phone
            </label>
            <input
              name="notification_sms_phone"
              type="tel"
              defaultValue={typedHorizonSettings?.notification_sms_phone ?? ''}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
            <p className="mt-2 text-sm text-slate-500">
              Used for internal Horizon operational SMS alerts only.
            </p>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
            >
              Save Notification Settings
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Create Horizon Staff</h2>
          <p className="mt-1 text-sm text-slate-500">
            This creates an auth user and links it to the internal `horizon_staff` role.
          </p>
        </div>

        <form action={createHorizonStaffAdmin} className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-2 block text-sm font-medium text-slate-600">Password</label>
            <input
              name="password"
              type="password"
              minLength={8}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div className="md:col-span-1 md:self-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
            >
              Create Horizon Staff
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-2xl font-semibold text-slate-900">Current Internal Users</h2>
          <p className="mt-1 text-sm text-slate-500">
            Admin users are shown for visibility. Delete controls are only available for Horizon
            Staff.
          </p>
        </div>

        {horizonUserItems.length === 0 ? (
          <div className="p-6">
            <p className="text-slate-600">No internal users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Email</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Role</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Active</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {horizonUserItems.map((user) => (
                  <tr key={user.user_id} className="border-t border-slate-200 align-top">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {user.email || 'Unknown email'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{user.role}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`rounded-full px-3 py-1 font-medium ${
                          user.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {user.role === 'horizon_staff' ? (
                        <form action={deleteHorizonStaffAdmin}>
                          <input type="hidden" name="user_id" value={user.user_id} />
                          <button
                            type="submit"
                            className="rounded-lg bg-rose-100 px-4 py-2 font-medium text-rose-800 hover:bg-rose-200"
                          >
                            Delete Staff
                          </button>
                        </form>
                      ) : (
                        <span className="text-slate-500">Admins cannot be deleted here.</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminSectionShell>
  )
}

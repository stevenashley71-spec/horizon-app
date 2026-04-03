import { redirect } from 'next/navigation'

import { AdminSectionShell } from '../../admin-section-shell'
import { ClinicForm } from '../clinic-form'
import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'

export default async function NewClinicPage() {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    redirect('/admin/login')
  }

  if (adminResult.kind === 'blocked') {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Create New Clinic
        </h1>
        <p className="mt-3 text-xl text-slate-500">{adminResult.message}</p>
      </div>
    )
  }

  return (
    <AdminSectionShell>
      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Create New Clinic
          </h1>
        </div>
      </section>

      <ClinicForm />
    </AdminSectionShell>
  )
}

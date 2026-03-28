import { redirect } from 'next/navigation'

import { ClinicAccessBlocked } from '@/app/components/clinic-access-blocked'
import { getClinicContextResult } from '@/lib/clinic-auth'

import { SummaryForm } from './summary-form'

export default async function SummaryPage() {
  const clinicResult = await getClinicContextResult()

  if (!clinicResult) {
    redirect('/clinic/login')
  }

  if (clinicResult.kind === 'blocked') {
    return <ClinicAccessBlocked message={clinicResult.message} />
  }

  return (
    <SummaryForm
      clinicId={clinicResult.clinic.clinicId}
      clinicName={clinicResult.clinic.clinicName}
    />
  )
}

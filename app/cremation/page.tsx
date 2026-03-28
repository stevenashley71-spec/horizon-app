import { redirect } from 'next/navigation'

import { ClinicAccessBlocked } from '@/app/components/clinic-access-blocked'
import { getClinicContextResult } from '@/lib/clinic-auth'

import { CremationForm } from './cremation-form'

export default async function CremationPage() {
  const clinicResult = await getClinicContextResult()

  if (!clinicResult) {
    redirect('/clinic/login')
  }

  if (clinicResult.kind === 'blocked') {
    return <ClinicAccessBlocked message={clinicResult.message} />
  }

  return (
    <CremationForm
      clinicId={clinicResult.clinic.clinicId}
      clinicName={clinicResult.clinic.clinicName}
    />
  )
}

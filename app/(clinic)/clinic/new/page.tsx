import { getClinicContextResult } from '@/lib/clinic-auth'

import { ClinicIntakeForm } from '../clinic-intake-form'

export default async function ClinicNewPage() {
  const clinicResult = await getClinicContextResult()

  if (!clinicResult || clinicResult.kind !== 'ok') {
    throw new Error('Clinic context is required')
  }

  const clinicContext = clinicResult.clinic

  return (
    <div className="mx-auto max-w-6xl">
        <ClinicIntakeForm
          clinicContext={{ id: clinicContext.clinicId, name: clinicContext.clinicName }}
          fallbackClinics={[]}
          allowDevClinicSelection={false}
          renderWithinPage
        />
    </div>
  )
}

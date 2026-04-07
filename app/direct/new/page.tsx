import { redirect } from 'next/navigation'

import { loadIntakeDraft } from '@/app/actions/intake/load-intake-draft'
import { getInternalHorizonUserResult } from '@/lib/internal-auth'

import { ClinicIntakeStartScreen } from '@/app/(clinic)/clinic/clinic-intake-start-screen'

export const dynamic = 'force-dynamic'

export default async function DirectNewPage() {
  const userResult = await getInternalHorizonUserResult()

  if (!userResult) {
    redirect('/admin/login')
  }

  if (userResult.kind === 'blocked') {
    redirect('/clinic')
  }

  const intake = await loadIntakeDraft(undefined, {
    clinicContextOverride: {
      clinicId: 'a7147f84-0706-4f75-ae16-6a58dfda8ea1',
    },
  })

  return <ClinicIntakeStartScreen intake={intake} isDirectKioskFlow />
}

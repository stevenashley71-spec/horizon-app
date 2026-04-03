import { loadIntakeDraft } from '@/app/actions/intake/load-intake-draft'

import { ClinicIntakeStartScreen } from '../clinic-intake-start-screen'

export default async function ClinicNewPage() {
  const intake = await loadIntakeDraft()

  return <ClinicIntakeStartScreen intake={intake} />
}

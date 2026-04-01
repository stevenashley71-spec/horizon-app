import { loadIntakeDraft } from '@/app/actions/intake/load-intake-draft'

import { ClinicIntakeForm } from '../clinic-intake-form'

export default async function ClinicNewPage() {
  const intake = await loadIntakeDraft()

  return <ClinicIntakeForm intake={intake} />
}

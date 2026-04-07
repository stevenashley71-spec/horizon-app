import { loadIntakeDraft } from '@/app/actions/intake/load-intake-draft'

import { ClinicIntakeForm } from '../clinic-intake-form'
import { ClinicIntakeStartScreen } from '../clinic-intake-start-screen'

export default async function ClinicNewPage({
  searchParams,
}: {
  searchParams: Promise<{ pin?: string; target?: string }>
}) {
  const intake = await loadIntakeDraft()
  const resolvedSearchParams = await searchParams
  const allowedTargets = new Set(['dashboard', 'cases', 'logout'])
  const rawTarget =
    typeof resolvedSearchParams?.target === 'string'
      ? resolvedSearchParams.target
      : undefined
  const pendingExitTarget =
    resolvedSearchParams?.pin === '1' && allowedTargets.has(rawTarget ?? '')
      ? (rawTarget as 'dashboard' | 'cases' | 'logout')
      : undefined

  if (pendingExitTarget) {
    return (
      <ClinicIntakeForm
        intake={intake}
        isDirectKioskFlow={false}
        pendingExitTarget={pendingExitTarget}
      />
    )
  }

  return <ClinicIntakeStartScreen intake={intake} isDirectKioskFlow={false} />
}

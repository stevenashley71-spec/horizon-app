import { redirect } from 'next/navigation'

import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'

import ScanPageClient from './scan-page-client'

export default async function ScanPage() {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult || adminResult.kind !== 'ok') {
    redirect('/admin/login')
  }

  return <ScanPageClient />
}

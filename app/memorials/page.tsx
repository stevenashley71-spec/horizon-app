import { redirect } from 'next/navigation'

import { getClinicAvailableProducts } from '@/app/actions/get-clinic-available-products'
import { ClinicAccessBlocked } from '@/app/components/clinic-access-blocked'
import { getClinicContextResult } from '@/lib/clinic-auth'
import {
  isMemorialCategory,
  isPremiumUrnCategory,
  isSoulburstCategory,
} from '@/lib/clinic-product-catalog'

import { MemorialsForm } from './memorials-form'

export default async function MemorialsPage() {
  const clinicResult = await getClinicContextResult()

  if (!clinicResult) {
    redirect('/clinic/login')
  }

  if (clinicResult.kind === 'blocked') {
    return <ClinicAccessBlocked message={clinicResult.message} />
  }

  const clinicId = clinicResult.clinic.clinicId
  const clinicName = clinicResult.clinic.clinicName

  try {
    const products = await getClinicAvailableProducts(clinicId)
    const memorialProducts = products.filter((product) => isMemorialCategory(product.category))
    const urnProducts = products.filter((product) => isPremiumUrnCategory(product.category))
    const soulburstProducts = products.filter((product) => isSoulburstCategory(product.category))
    const shouldSkipToSummary =
      memorialProducts.length === 0 &&
      urnProducts.length === 0 &&
      soulburstProducts.length === 0

    return (
      <MemorialsForm
        clinicId={clinicId}
        clinicName={clinicName}
        memorialProducts={memorialProducts}
        shouldSkipToSummary={shouldSkipToSummary}
        loadError={null}
      />
    )
  } catch (error) {
    return (
      <MemorialsForm
        clinicId={clinicId}
        clinicName={clinicName}
        memorialProducts={[]}
        shouldSkipToSummary={false}
        loadError={error instanceof Error ? error.message : 'Failed to load memorial products.'}
      />
    )
  }
}

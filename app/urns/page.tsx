import { redirect } from 'next/navigation'

import { getClinicAvailableProducts } from '@/app/actions/get-clinic-available-products'
import { ClinicAccessBlocked } from '@/app/components/clinic-access-blocked'
import { getClinicContextResult } from '@/lib/clinic-auth'
import {
  isPremiumUrnCategory,
  isSoulburstCategory,
} from '@/lib/clinic-product-catalog'

import { UrnsForm } from './urns-form'

export default async function UrnsPage() {
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

    return (
      <UrnsForm
        clinicId={clinicId}
        clinicName={clinicName}
        urnProducts={products.filter((product) => isPremiumUrnCategory(product.category))}
        soulburstProducts={products.filter((product) => isSoulburstCategory(product.category))}
        loadError={null}
      />
    )
  } catch (error) {
    return (
      <UrnsForm
        clinicId={clinicId}
        clinicName={clinicName}
        urnProducts={[]}
        soulburstProducts={[]}
        loadError={error instanceof Error ? error.message : 'Failed to load urn and SoulBursts products.'}
      />
    )
  }
}

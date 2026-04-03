import { redirect } from 'next/navigation'

import {
  addCremationPricingRow,
  saveCremationPricingRow,
} from '@/app/actions/admin-cremation-pricing'
import { saveClinicProductAvailability } from '@/app/actions/admin-clinic-products'
import { AdminSectionShell } from '../admin-section-shell'
import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServerSupabase } from '@/lib/supabase/server'

type ClinicProductsPageProps = {
  searchParams: Promise<{
    clinicId?: string
  }>
}

type ClinicRow = {
  id: string
  name: string
  is_active: boolean
}

type ProductRow = {
  id: string
  name: string
  category: string
  base_price: number
  is_active: boolean
  sort_order: number
}

type ClinicProductRow = {
  clinic_id: string
  product_id: string
  is_active: boolean
  price_override: number | null
}

type CremationPricingRow = {
  id: string
  clinic_id: string | null
  cremation_type: 'private' | 'general'
  weight_min_lbs: number | null
  weight_max_lbs: number | null
  client_price: number | null
  horizon_invoice_price: number | null
  is_active: boolean
  sort_order: number
}

function formatCurrency(value: number | null) {
  return typeof value === 'number' ? `$${value.toFixed(2)}` : '—'
}

function formatWeightRange(row: {
  weight_min_lbs: number | null
  weight_max_lbs: number | null
}) {
  if (row.weight_min_lbs !== null && row.weight_max_lbs !== null) {
    return `${row.weight_min_lbs}-${row.weight_max_lbs} lbs`
  }

  if (row.weight_min_lbs !== null) {
    return `${row.weight_min_lbs}+ lbs`
  }

  if (row.weight_max_lbs !== null) {
    return `Up to ${row.weight_max_lbs} lbs`
  }

  return 'Unbounded'
}

export default async function ClinicProductsAdminPage({
  searchParams,
}: ClinicProductsPageProps) {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    redirect('/admin/login')
  }

  if (adminResult.kind === 'blocked') {
    return (
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Clinic Product Availability
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            {adminResult.message}
          </p>
        </div>
    )
  }

  const params = await searchParams
  const selectedClinicId = params.clinicId?.trim() ?? ''
  const selectedClinicQuery = selectedClinicId ? `?clinicId=${selectedClinicId}` : ''

  const supabase = await createServerSupabase()

  const { data: clinics, error: clinicsError } = await supabase
    .from('clinics')
    .select('id, name, is_active')
    .order('name', { ascending: true })

  if (clinicsError) {
    throw new Error(clinicsError.message)
  }

  const clinicItems = (clinics as ClinicRow[] | null) ?? []
  const selectedClinic = clinicItems.find((clinic) => clinic.id === selectedClinicId) ?? null

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, category, base_price, is_active, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (productsError) {
    throw new Error(productsError.message)
  }

  let clinicProductOverrides = new Map<string, ClinicProductRow>()
  let cremationPricingItems: CremationPricingRow[] = []

  if (selectedClinicId) {
    const { data: clinicProducts, error: clinicProductsError } = await supabase
      .from('clinic_products')
      .select('clinic_id, product_id, is_active, price_override')
      .eq('clinic_id', selectedClinicId)

    if (clinicProductsError) {
      throw new Error(clinicProductsError.message)
    }

    clinicProductOverrides = new Map(
      ((clinicProducts as ClinicProductRow[] | null) ?? []).map((row) => [row.product_id, row])
    )

    const { data: cremationPricing, error: cremationPricingError } = await supabase
      .from('cremation_pricing')
      .select(
        'id, clinic_id, cremation_type, weight_min_lbs, weight_max_lbs, client_price, horizon_invoice_price, is_active, sort_order'
      )
      .eq('clinic_id', selectedClinicId)
      .order('sort_order', { ascending: true })
      .order('cremation_type', { ascending: true })

    if (cremationPricingError) {
      throw new Error(cremationPricingError.message)
    }

    cremationPricingItems = (cremationPricing as CremationPricingRow[] | null) ?? []
  }

  const productItems = (products as ProductRow[] | null) ?? []
  const addCremationPricingRowForClinic = addCremationPricingRow.bind(null, selectedClinicId)

  return (
    <AdminSectionShell>
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Clinic Product Availability
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              Control which products are available for each clinic.
            </p>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label htmlFor="clinicId" className="mb-2 block text-sm font-medium text-slate-600">
                Select Clinic
              </label>
              <select
                id="clinicId"
                name="clinicId"
                defaultValue={selectedClinicId}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
              >
                <option value="">Choose a clinic</option>
                {clinicItems.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name} {clinic.is_active ? '' : '(Inactive)'}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
            >
              Load Products
            </button>
          </form>
        </section>

        {!selectedClinic ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-600">Select a clinic to manage product availability.</p>
          </section>
        ) : (
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-2xl font-semibold text-slate-900">{selectedClinic.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Global product activity is the default. Clinic-specific rows override availability.
              </p>
            </div>

            {productItems.length === 0 ? (
              <div className="p-6">
                <p className="text-slate-600">No products exist yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="text-left">
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Product</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Category</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Base Price</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Global</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Clinic</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Price Override</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productItems.map((product) => {
                      const override = clinicProductOverrides.get(product.id)
                      const effectiveIsActive = override ? override.is_active : product.is_active

                      return (
                        <tr key={product.id} className="border-t border-slate-200 align-top">
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            {product.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">{product.category}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatCurrency(product.base_price)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`rounded-full px-3 py-1 font-medium ${
                                product.is_active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {product.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`rounded-full px-3 py-1 font-medium ${
                                effectiveIsActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {effectiveIsActive ? 'Available' : 'Unavailable'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <form action={saveClinicProductAvailability} className="flex items-center gap-3">
                              <input type="hidden" name="clinic_id" value={selectedClinicId} />
                              <input type="hidden" name="product_id" value={product.id} />
                              <input
                                type="hidden"
                                name="is_active"
                                value={effectiveIsActive ? 'false' : 'true'}
                              />
                              <input
                                name="price_override"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={override?.price_override ?? ''}
                                placeholder="Optional"
                                className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                              />
                              <button
                                type="submit"
                                className={`rounded-lg px-4 py-2 font-medium ${
                                  effectiveIsActive
                                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                    : 'bg-emerald-900 text-white hover:bg-emerald-800'
                                }`}
                              >
                                {effectiveIsActive ? 'Turn Off' : 'Turn On'}
                              </button>
                            </form>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {override
                              ? 'Clinic override saved'
                              : 'Using global default'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {selectedClinic ? (
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Cremation Pricing</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage clinic-specific cremation pricing rows by cremation type and weight range.
                  </p>
                </div>
                <form action={addCremationPricingRowForClinic}>
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
                  >
                    Add Row
                  </button>
                </form>
              </div>
            </div>

            {cremationPricingItems.length === 0 ? (
              <div className="p-6">
                <p className="text-slate-600">No cremation pricing rows saved for this clinic yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="text-left">
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Cremation Type</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Weight Range</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Client Price</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Horizon Invoice Price</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Active</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Edit</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cremationPricingItems.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200 align-top">
                        <td className="px-6 py-4 text-sm text-slate-700">{row.cremation_type}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{formatWeightRange(row)}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {formatCurrency(row.client_price)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {formatCurrency(row.horizon_invoice_price)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`rounded-full px-3 py-1 font-medium ${
                              row.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {row.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          <form action={saveCremationPricingRow} className="grid gap-3 md:grid-cols-6">
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="clinic_id" value={selectedClinicId} />
                            <input type="hidden" name="sort_order" value={row.sort_order} />
                            <select
                              name="cremation_type"
                              defaultValue={row.cremation_type}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                            >
                              <option value="private">private</option>
                              <option value="general">general</option>
                            </select>
                            <input
                              name="weight_min_lbs"
                              type="number"
                              step="0.01"
                              defaultValue={row.weight_min_lbs ?? ''}
                              placeholder="Min lbs"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                            />
                            <input
                              name="weight_max_lbs"
                              type="number"
                              step="0.01"
                              defaultValue={row.weight_max_lbs ?? ''}
                              placeholder="Max lbs"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                            />
                            <input
                              name="client_price"
                              type="number"
                              step="0.01"
                              defaultValue={row.client_price ?? ''}
                              placeholder="Client"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                            />
                            <input
                              name="horizon_invoice_price"
                              type="number"
                              step="0.01"
                              defaultValue={row.horizon_invoice_price ?? ''}
                              placeholder="Invoice"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                            />
                            <select
                              name="is_active"
                              defaultValue={row.is_active ? 'true' : 'false'}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                            >
                              <option value="true">Active</option>
                              <option value="false">Inactive</option>
                            </select>
                            <button
                              type="submit"
                              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
                            >
                              Save
                            </button>
                          </form>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          Sort order: {row.sort_order}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
    </AdminSectionShell>
  )
}

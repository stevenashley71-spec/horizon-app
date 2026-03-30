import { redirect } from 'next/navigation'

import { saveClinicProductAvailability } from '@/app/actions/admin-clinic-products'
import { setProductActive } from '@/app/actions/admin-products'
import { AdminSectionShell } from '../admin-section-shell'
import { ProductForm } from './product-form'
import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type ProductsAdminPageProps = {
  searchParams: Promise<{
    clinicId?: string
  }>
}

type ProductRow = {
  id: string
  name: string
  category: string
  description: string | null
  base_price: number
  image_path: string | null
  image_alt_text: string | null
  is_active: boolean
  included_by_default: boolean
  sort_order: number
}

type ClinicRow = {
  id: string
  name: string
  is_active: boolean
}

type ClinicProductRow = {
  clinic_id: string
  product_id: string
  is_active: boolean
  price_override: number | null
}

function getImageUrl(imagePath: string | null) {
  if (!imagePath) {
    return null
  }

  const supabase = createServiceRoleSupabase()
  const { data } = supabase.storage.from('product-images').getPublicUrl(imagePath)
  return data.publicUrl
}

function formatCurrency(value: number | null) {
  return typeof value === 'number' ? `$${value.toFixed(2)}` : '—'
}

export default async function ProductsAdminPage({
  searchParams,
}: ProductsAdminPageProps) {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    redirect('/admin/login')
  }

  if (adminResult.kind === 'blocked') {
    return (
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Products Admin
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            {adminResult.message}
          </p>
        </div>
    )
  }

  const params = await searchParams
  const selectedClinicId = params.clinicId?.trim() ?? ''

  const supabase = createServiceRoleSupabase()
  const { data: products, error } = await supabase
    .from('products')
    .select(
      'id, name, category, description, base_price, image_path, image_alt_text, is_active, included_by_default, sort_order'
    )
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const productItems = ((products as ProductRow[] | null) ?? []).map((product) => ({
    ...product,
    image_url: getImageUrl(product.image_path),
  }))

  const { data: clinics, error: clinicsError } = await supabase
    .from('clinics')
    .select('id, name, is_active')
    .order('name', { ascending: true })

  if (clinicsError) {
    throw new Error(clinicsError.message)
  }

  const clinicItems = (clinics as ClinicRow[] | null) ?? []
  const selectedClinic = clinicItems.find((clinic) => clinic.id === selectedClinicId) ?? null

  let clinicProductOverrides = new Map<string, ClinicProductRow>()

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
  }

  return (
    <AdminSectionShell>
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Products Admin
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              Create test products and assign them to clinics for the intake flow.
            </p>
          </div>
        </section>

        <ProductForm />

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Existing Products</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update product details, active status, and default urn behavior.
            </p>
          </div>

          {productItems.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-slate-600">No products have been created yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {productItems.map((product) => (
                <div key={product.id} className="space-y-4">
                  <div className="flex justify-end">
                    <form
                      action={async () => {
                        'use server'
                        await setProductActive(product.id, !product.is_active)
                      }}
                    >
                      <button
                        type="submit"
                        className={`rounded-lg px-4 py-2 font-medium ${
                          product.is_active
                            ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                            : 'bg-emerald-900 text-white hover:bg-emerald-800'
                        }`}
                      >
                        {product.is_active ? 'Deactivate Product' : 'Activate Product'}
                      </button>
                    </form>
                  </div>
                  <ProductForm product={product} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Clinic Product Assignment</h2>
            <p className="mt-1 text-sm text-slate-500">
              Assign products to clinics and optionally set clinic-specific pricing.
            </p>
          </div>

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
                Load Assignments
              </button>
            </form>
          </section>

          {!selectedClinic ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-slate-600">Select a clinic to manage product assignment.</p>
            </section>
          ) : (
            <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h3 className="text-2xl font-semibold text-slate-900">{selectedClinic.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Product activity defaults to the global setting until a clinic override is saved.
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
                              {override ? 'Clinic override saved' : 'Using global default'}
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
        </section>
    </AdminSectionShell>
  )
}

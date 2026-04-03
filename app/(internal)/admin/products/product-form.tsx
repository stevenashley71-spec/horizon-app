'use client'

import type { ChangeEvent, DragEvent } from 'react'
import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { saveProductAdmin } from '@/app/actions/admin-products'
import {
  PRODUCT_CATEGORY_OPTIONS,
  type ProductCategory,
} from '@/lib/clinic-product-catalog'

type ProductFormProps = {
  product?: {
    id: string
    name: string
    category: ProductCategory | string
    description: string | null
    base_price: number
    image_path: string | null
    image_alt_text: string | null
    is_active: boolean
    included_by_default: boolean
    sort_order: number
    image_url: string | null
  }
}

type ProductFormState = {
  error: string | null
  success: string | null
}

const initialState: ProductFormState = {
  error: null,
  success: null,
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Saving...' : label}
    </button>
  )
}

export function ProductForm({ product }: ProductFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [state, formAction] = useActionState(
    async (_previousState: ProductFormState, formData: FormData): Promise<ProductFormState> => {
      try {
        const result = await saveProductAdmin(formData)
        if ('error' in result && result.error) {
          return {
            error: result.error,
            success: null,
          }
        }

        return {
          error: null,
          success: product ? 'Product updated successfully.' : 'Product created successfully.',
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : null,
          success: null,
        }
      }
    },
    initialState
  )

  function syncDroppedFile(file: File) {
    setSelectedFile(file)

    if (!fileInputRef.current) {
      return
    }

    const transfer = new DataTransfer()
    transfer.items.add(file)
    fileInputRef.current.files = transfer.files
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files?.[0]
    if (file) {
      syncDroppedFile(file)
    }
  }

  return (
    <form action={formAction} className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="product_id" value={product?.id ?? ''} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {product ? product.name : 'Create Product'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {product ? 'Update product catalog details.' : 'Add a new product to the catalog.'}
          </p>
        </div>
        {product ? (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              product.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {product.is_active ? 'Active' : 'Inactive'}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`product-name-${product?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Product Name
          </label>
          <input
            id={`product-name-${product?.id ?? 'new'}`}
            name="name"
            defaultValue={product?.name ?? ''}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>

        <div>
          <label htmlFor={`product-category-${product?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Category
          </label>
          <select
            id={`product-category-${product?.id ?? 'new'}`}
            name="category"
            defaultValue={product?.category ?? ''}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          >
            <option value="">Select Category</option>
            {PRODUCT_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`product-base-price-${product?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Base Price
          </label>
          <input
            id={`product-base-price-${product?.id ?? 'new'}`}
            name="base_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.base_price ?? ''}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>

        <div>
          <label htmlFor={`product-sort-order-${product?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Sort Order
          </label>
          <input
            id={`product-sort-order-${product?.id ?? 'new'}`}
            name="sort_order"
            type="number"
            step="1"
            defaultValue={product?.sort_order ?? 0}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Product Active
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900">
            <input
              name="is_active"
              type="checkbox"
              value="true"
              defaultChecked={product?.is_active ?? true}
              className="h-4 w-4"
            />
            Active in product catalog
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Included By Default
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900">
            <input
              name="included_by_default"
              type="checkbox"
              value="true"
              defaultChecked={product?.included_by_default ?? false}
              className="h-4 w-4"
            />
            Use as the included default urn
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Product Image Upload
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border border-dashed px-5 py-6 text-center transition-colors ${
              isDragging ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-slate-50'
            }`}
          >
            <p className="text-base font-medium text-slate-900">
              Drag and drop a product image here
            </p>
            <p className="mt-2 text-sm text-slate-500">Or click to choose an image file</p>
            <p className="mt-3 text-sm text-slate-600">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              name="image_file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`product-image-path-${product?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Image Path
          </label>
          <input
            id={`product-image-path-${product?.id ?? 'new'}`}
            name="image_path"
            defaultValue={product?.image_path ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>

        <div>
          <label htmlFor={`product-image-alt-${product?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Image Alt Text
          </label>
          <input
            id={`product-image-alt-${product?.id ?? 'new'}`}
            name="image_alt_text"
            defaultValue={product?.image_alt_text ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor={`product-description-${product?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Description
          </label>
          <textarea
            id={`product-description-${product?.id ?? 'new'}`}
            name="description"
            defaultValue={product?.description ?? ''}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
      </div>

      {state.error && <p className="text-red-600">{state.error}</p>}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}

      <div className="flex justify-end">
        <SubmitButton label={product ? 'Save Product' : 'Create Product'} />
      </div>
    </form>
  )
}

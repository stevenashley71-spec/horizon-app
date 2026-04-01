'use client'

import type { ChangeEvent, DragEvent } from 'react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { saveClinicAdmin } from '@/app/actions/admin-clinics'

type ClinicFormProps = {
  clinic?: {
    id: string
    name: string
    code: string | null
    pickup_verification_code: string | null
    delivery_verification_code: string | null
    address_line_1: string | null
    address_line_2: string | null
    city: string | null
    state: string | null
    zip: string | null
    phone: string | null
    email: string | null
    logo_path: string | null
    logo_alt_text: string | null
    logo_url: string | null
    is_active: boolean
  }
}

type ClinicFormState = {
  error: string | null
  success: string | null
}

const initialState: ClinicFormState = {
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

export function ClinicForm({ clinic }: ClinicFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null)

  const [state, formAction] = useActionState(
    async (_previousState: ClinicFormState, formData: FormData): Promise<ClinicFormState> => {
      try {
        await saveClinicAdmin(formData)
        setSelectedFile(null)
        setRemoveLogo(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return {
          error: null,
          success: clinic ? 'Clinic updated successfully.' : 'Clinic created successfully.',
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to save clinic.',
          success: null,
        }
      }
    },
    initialState
  )

  useEffect(() => {
    if (!selectedFile) {
      setSelectedPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setSelectedPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedFile])

  const previewUrl = selectedPreviewUrl ?? (!removeLogo ? clinic?.logo_url ?? null : null)

  const previewLabel = selectedFile
    ? 'Selected logo preview'
    : clinic?.logo_url && !removeLogo
      ? 'Current logo'
      : 'No logo uploaded'

  function syncDroppedFile(file: File) {
    setSelectedFile(file)
    setRemoveLogo(false)

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
    if (file) {
      setRemoveLogo(false)
    }
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
      <input type="hidden" name="clinic_id" value={clinic?.id ?? ''} />
      <input type="hidden" name="remove_logo" value={removeLogo ? 'true' : 'false'} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {clinic ? clinic.name : 'Create Clinic'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {clinic ? 'Update clinic details and branding.' : 'Add a new clinic to Horizon.'}
          </p>
        </div>
        {clinic ? (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              clinic.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {clinic.is_active ? 'Active' : 'Inactive'}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`clinic-name-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Clinic Name
          </label>
          <input
            id={`clinic-name-${clinic?.id ?? 'new'}`}
            name="name"
            defaultValue={clinic?.name ?? ''}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div>
          <label htmlFor={`clinic-code-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Code
          </label>
          <input
            id={`clinic-code-${clinic?.id ?? 'new'}`}
            name="code"
            defaultValue={clinic?.code ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div>
          <label
            htmlFor={`clinic-pickup-verification-code-${clinic?.id ?? 'new'}`}
            className="mb-2 block text-sm font-medium text-slate-600"
          >
            Pickup Verification Code
          </label>
          <input
            id={`clinic-pickup-verification-code-${clinic?.id ?? 'new'}`}
            name="pickup_verification_code"
            type="text"
            defaultValue={clinic?.pickup_verification_code ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div>
          <label
            htmlFor={`clinic-delivery-verification-code-${clinic?.id ?? 'new'}`}
            className="mb-2 block text-sm font-medium text-slate-600"
          >
            Delivery Verification Code
          </label>
          <input
            id={`clinic-delivery-verification-code-${clinic?.id ?? 'new'}`}
            type="text"
            value={clinic?.delivery_verification_code ?? ''}
            readOnly
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`clinic-address-1-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Address Line 1
          </label>
          <input
            id={`clinic-address-1-${clinic?.id ?? 'new'}`}
            name="address_line_1"
            defaultValue={clinic?.address_line_1 ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`clinic-address-2-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Address Line 2
          </label>
          <input
            id={`clinic-address-2-${clinic?.id ?? 'new'}`}
            name="address_line_2"
            defaultValue={clinic?.address_line_2 ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div>
          <label htmlFor={`clinic-city-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            City
          </label>
          <input
            id={`clinic-city-${clinic?.id ?? 'new'}`}
            name="city"
            defaultValue={clinic?.city ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div>
          <label htmlFor={`clinic-state-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            State
          </label>
          <input
            id={`clinic-state-${clinic?.id ?? 'new'}`}
            name="state"
            defaultValue={clinic?.state ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div>
          <label htmlFor={`clinic-zip-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            ZIP
          </label>
          <input
            id={`clinic-zip-${clinic?.id ?? 'new'}`}
            name="zip"
            defaultValue={clinic?.zip ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div>
          <label htmlFor={`clinic-phone-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Phone
          </label>
          <input
            id={`clinic-phone-${clinic?.id ?? 'new'}`}
            name="phone"
            defaultValue={clinic?.phone ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`clinic-email-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
            Email
          </label>
          <input
            id={`clinic-email-${clinic?.id ?? 'new'}`}
            name="email"
            type="email"
            defaultValue={clinic?.email ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-600">Logo Preview</div>
            <div className="flex h-[140px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={clinic?.logo_alt_text || 'Clinic logo preview'}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-center text-sm text-slate-500">{previewLabel}</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-2xl border border-dashed px-5 py-8 text-center transition-colors ${
                isDragging
                  ? 'border-slate-900 bg-slate-100'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <p className="text-base font-medium text-slate-900">
                Drag and drop a clinic logo here
              </p>
              <p className="mt-2 text-sm text-slate-500">
                PNG, JPG, WEBP, or SVG. Max 5MB.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-900 hover:bg-slate-300"
                >
                  Browse Files
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                name="logo_file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div>
              <label htmlFor={`clinic-logo-alt-${clinic?.id ?? 'new'}`} className="mb-2 block text-sm font-medium text-slate-600">
                Logo Alt Text
              </label>
              <input
                id={`clinic-logo-alt-${clinic?.id ?? 'new'}`}
                name="logo_alt_text"
                defaultValue={clinic?.logo_alt_text ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {clinic?.logo_url || selectedFile ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null)
                    setRemoveLogo(true)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="rounded-lg bg-rose-100 px-4 py-2 font-medium text-rose-800 hover:bg-rose-200"
                >
                  Remove Logo
                </button>
              ) : null}
              <span className="text-sm text-slate-500">
                {selectedFile
                  ? `Selected file: ${selectedFile.name}`
                  : clinic?.logo_url && !removeLogo
                    ? 'Current logo is saved'
                    : 'No logo selected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {state.error ? <p className="text-sm text-rose-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}

      <div className="flex justify-end">
        <SubmitButton label={clinic ? 'Save Clinic' : 'Create Clinic'} />
      </div>
    </form>
  )
}

'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type UnlockClinicExitPinResult = {
  success: boolean
  error: string | null
}

const initialState: UnlockClinicExitPinResult = {
  success: false,
  error: null,
}

export function ClinicExitPinLock({
  unlockAction,
  children,
}: {
  unlockAction: (
    previousState: UnlockClinicExitPinResult,
    formData: FormData
  ) => Promise<UnlockClinicExitPinResult>
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [state, formAction] = useActionState(unlockAction, initialState)
  const pendingButtonRef = useRef<HTMLButtonElement | null>(null)
  const bypassButtonRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    function openModalForHref(href: string) {
      pendingButtonRef.current = null
      setPendingHref(href)
      setErrorMessage(null)
      setIsModalOpen(true)
    }

    function openModalForButton(button: HTMLButtonElement) {
      pendingButtonRef.current = button
      setPendingHref(null)
      setErrorMessage(null)
      setIsModalOpen(true)
    }

    function handleBackLinkClick(event: MouseEvent) {
      const currentTarget = event.currentTarget

      if (!(currentTarget instanceof HTMLAnchorElement)) {
        return
      }

      event.preventDefault()
      openModalForHref(currentTarget.getAttribute('href') ?? '/cases')
    }

    function handleClinicNavLinkClick(event: MouseEvent) {
      const currentTarget = event.currentTarget

      if (!(currentTarget instanceof HTMLAnchorElement)) {
        return
      }

      event.preventDefault()
      openModalForHref(currentTarget.getAttribute('href') ?? '/clinic')
    }

    function handleClinicNavButtonClick(event: MouseEvent) {
      const currentTarget = event.currentTarget

      if (!(currentTarget instanceof HTMLButtonElement)) {
        return
      }

      if (bypassButtonRef.current === currentTarget) {
        bypassButtonRef.current = null
        return
      }

      event.preventDefault()
      event.stopPropagation()
      openModalForButton(currentTarget)
    }

    const backLink = document.getElementById('case-detail-back-link')
    const clinicNavLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'main nav a[href="/clinic"], main nav a[href="/clinic/new"], main nav a[href="/cases"]'
      )
    )
    const clinicNavButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('main nav button'))

    if (backLink instanceof HTMLAnchorElement) {
      backLink.addEventListener('click', handleBackLinkClick)
    }

    clinicNavLinks.forEach((link) => {
      link.addEventListener('click', handleClinicNavLinkClick)
    })

    clinicNavButtons.forEach((button) => {
      button.addEventListener('click', handleClinicNavButtonClick, true)
    })

    return () => {
      if (backLink instanceof HTMLAnchorElement) {
        backLink.removeEventListener('click', handleBackLinkClick)
      }

      clinicNavLinks.forEach((link) => {
        link.removeEventListener('click', handleClinicNavLinkClick)
      })

      clinicNavButtons.forEach((button) => {
        button.removeEventListener('click', handleClinicNavButtonClick, true)
      })
    }
  }, [])

  useEffect(() => {
    if (state.success) {
      setErrorMessage(null)
      setIsModalOpen(false)

      if (pendingHref) {
        router.push(pendingHref)
        return
      }

      if (pendingButtonRef.current) {
        const button = pendingButtonRef.current
        pendingButtonRef.current = null
        bypassButtonRef.current = button
        button.click()
      }
      return
    }

    if (state.error) {
      setErrorMessage(state.error)
    }
  }, [pendingHref, router, state.error, state.success])

  useEffect(() => {
    if (isModalOpen) {
      inputRef.current?.focus()
    }
  }, [isModalOpen])

  return (
    <>
      {isModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-6 py-8"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Staff Unlock Required
            </h2>
            <p className="mt-3 text-base text-slate-500">
              Enter the clinic exit PIN to leave this case detail screen.
            </p>

            <form action={formAction} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="clinic-exit-pin-input"
                  className="mb-2 block text-sm font-medium text-slate-600"
                >
                  PIN
                </label>
                <input
                  id="clinic-exit-pin-input"
                  ref={inputRef}
                  name="exit_pin"
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                />
              </div>

              {errorMessage ? (
                <p className="text-sm text-rose-700">{errorMessage}</p>
              ) : null}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
                >
                  Unlock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setPendingHref(null)
                    pendingButtonRef.current = null
                    setErrorMessage(null)
                  }}
                  className="rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {children}
    </>
  )
}

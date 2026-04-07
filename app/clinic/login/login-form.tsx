'use client'

import { useEffect, useRef, useState } from 'react'

import { supabase } from '@/lib/supabase/client'

export function ClinicLoginForm() {
  console.log('CLIENT COMPONENT RENDERED')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFired, setSubmitFired] = useState(false)
  const [buttonClicked, setButtonClicked] = useState(false)
  const [tapTestTriggered, setTapTestTriggered] = useState(false)
  const [nativeTapDetected, setNativeTapDetected] = useState(false)
  const tapTestRef = useRef<HTMLDivElement | null>(null)
  const [debugInfo, setDebugInfo] = useState<{
    hasSession: boolean
    accessTokenPreview: string
    cookieString: string
    currentUrl: string
  } | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setSubmitFired(true)
    console.log('SUBMIT HANDLER FIRED')
    setError(null)
    setIsSubmitting(true)

    await supabase.auth.signOut()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message || 'Unable to sign in.')
      setIsSubmitting(false)
      return
    }

    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token ?? ''

    setDebugInfo({
      hasSession: Boolean(data.session),
      accessTokenPreview: accessToken ? accessToken.slice(0, 120) : '',
      cookieString: document.cookie,
      currentUrl: window.location.href,
    })
    setIsSubmitting(false)
  }

  useEffect(() => {
    const element = tapTestRef.current

    if (!element) {
      return
    }

    const handleNativeTouchStart = () => {
      console.log('NATIVE TAP TEST TOUCH START')
      setNativeTapDetected(true)
    }

    const handleNativePointerDown = () => {
      console.log('NATIVE TAP TEST POINTER DOWN')
      setNativeTapDetected(true)
    }

    const handleNativeClick = () => {
      console.log('NATIVE TAP TEST CLICK')
      setNativeTapDetected(true)
    }

    element.addEventListener('touchstart', handleNativeTouchStart)
    element.addEventListener('pointerdown', handleNativePointerDown)
    element.addEventListener('click', handleNativeClick)

    return () => {
      element.removeEventListener('touchstart', handleNativeTouchStart)
      element.removeEventListener('pointerdown', handleNativePointerDown)
      element.removeEventListener('click', handleNativeClick)
    }
  }, [])

  return (
    <main className="relative z-0 min-h-screen bg-[linear-gradient(180deg,#f3f0e8_0%,#f7f8fa_100%)] px-6 py-6 md:px-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-5 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[40px] font-extrabold tracking-tight text-slate-900 md:text-[44px]">
              Horizon Pet Cremation
            </h1>
            <p className="mt-2 text-[18px] text-slate-500">
              Secure sign-in for clinics and Horizon staff
            </p>
          </div>
        </div>

        <div className="relative z-[9999] mx-auto mt-14 max-w-[500px] rounded-[24px] border border-black/5 bg-white px-8 py-8 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <div className="w-full rounded-[14px] bg-slate-900 px-4 py-3 text-center text-sm font-extrabold tracking-wide text-white">
            MOBILE DEBUG BUILD 002
          </div>
          <div className="mt-3 rounded-[14px] bg-blue-100 px-4 py-3 text-sm font-extrabold tracking-wide text-blue-900">
            CLIENT JS ACTIVE BUILD 002
          </div>
          <div
            ref={tapTestRef}
            className="mt-3 w-full rounded-[14px] border-2 border-dashed border-fuchsia-400 bg-fuchsia-100 px-4 py-6 text-center text-sm font-extrabold tracking-wide text-fuchsia-900"
            onPointerDown={() => {
              console.log('TAP TEST POINTER DOWN')
              setTapTestTriggered(true)
            }}
            onTouchStart={() => {
              console.log('TAP TEST TOUCH START')
              setTapTestTriggered(true)
            }}
            onClick={() => {
              console.log('TAP TEST CLICK')
              setTapTestTriggered(true)
            }}
          >
            TAP TEST AREA BUILD 003
          </div>
          {tapTestTriggered ? (
            <div className="mt-3 rounded-[14px] bg-fuchsia-200 px-4 py-3 text-sm font-extrabold tracking-wide text-fuchsia-950">
              TAP TEST DETECTED BUILD 003
            </div>
          ) : null}
          {nativeTapDetected ? (
            <div className="mt-3 rounded-[14px] bg-cyan-200 px-4 py-3 text-sm font-extrabold tracking-wide text-cyan-950">
              NATIVE TAP DETECTED BUILD 004
            </div>
          ) : null}
          <h2 className="text-[34px] font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-2.5 text-[16px] text-slate-500">
            Clinic names are not shown before login.
          </p>

          {submitFired ? (
            <div className="mt-4 rounded-[14px] bg-emerald-100 px-4 py-3 text-sm font-extrabold tracking-wide text-emerald-900">
              SUBMIT HANDLER RAN BUILD 002
            </div>
          ) : null}

          <form className="mt-7 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="Enter email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-4 text-[16px] text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-4 text-[16px] text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            {buttonClicked ? (
              <div className="mt-3 rounded-[14px] bg-purple-100 px-4 py-3 text-sm font-extrabold tracking-wide text-purple-900">
                BUTTON CLICK DETECTED
              </div>
            ) : null}

            <button
              type="button"
              onClick={(e) => {
                console.log('BUTTON CLICKED')
                setButtonClicked(true)
                handleSubmit(e as any)
              }}
              disabled={isSubmitting}
              className="mt-1 inline-flex rounded-[14px] bg-[#23423a] px-6 py-3.5 text-[16px] font-extrabold text-white transition-colors hover:bg-[#1d3731]"
            >
              {isSubmitting ? 'Signing in...' : 'LOGIN BUTTON BUILD 002'}
            </button>

            {error ? (
              <p className="text-sm font-medium text-rose-700">{error}</p>
            ) : null}
          </form>

          {debugInfo ? (
            <div className="mt-6 rounded-[18px] border border-amber-200 bg-amber-50 p-5 text-left">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                Temporary mobile auth debug
              </p>
              <p className="mt-3 text-base font-semibold text-slate-900">Login success</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p>Session exists: {debugInfo.hasSession ? 'Yes' : 'No'}</p>
                <p>Access token preview: {debugInfo.accessTokenPreview || 'None'}</p>
                <p>Current URL: {debugInfo.currentUrl}</p>
                <p className="break-all">document.cookie: {debugInfo.cookieString || '(empty)'}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

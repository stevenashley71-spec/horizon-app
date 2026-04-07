'use client'

import { useState } from 'react'

import { supabase } from '@/lib/supabase/client'

export function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [debugInfo, setDebugInfo] = useState<{
    hasSession: boolean
    accessTokenPreview: string
    cookieString: string
    currentUrl: string
  } | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

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

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 md:px-10">
      <div className="mx-auto max-w-xl rounded-[28px] bg-white p-8 shadow-sm">
        <div className="w-full rounded-[14px] bg-slate-900 px-4 py-3 text-center text-sm font-extrabold tracking-wide text-white">
          MOBILE DEBUG BUILD 001
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Horizon Internal Sign-In
        </h1>
        <p className="mt-3 text-lg text-slate-500">
          Secure sign-in for Horizon administrators and staff.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="admin-email"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Email
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Password
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-slate-900 px-6 py-3 text-lg font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
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
    </main>
  )
}

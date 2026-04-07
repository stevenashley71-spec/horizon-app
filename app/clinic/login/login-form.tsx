'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase/client'

export function ClinicLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit() {
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

    router.push('/clinic')
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f3f0e8_0%,#f7f8fa_100%)] px-6 py-6 md:px-8">
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

        <div className="mx-auto mt-14 max-w-[500px] rounded-[24px] border border-black/5 bg-white px-8 py-8 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <h2 className="text-[34px] font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-2.5 text-[16px] text-slate-500">
            Clinic names are not shown before login.
          </p>

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

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="mt-1 inline-flex rounded-[14px] bg-[#23423a] px-6 py-3.5 text-[16px] font-extrabold text-white transition-colors hover:bg-[#1d3731]"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            {error ? (
              <p className="text-sm font-medium text-rose-700">{error}</p>
            ) : null}
          </form>
        </div>
      </div>
    </main>
  )
}

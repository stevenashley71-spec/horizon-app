'use client'

import Link from 'next/link'

export default function CaseDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Unable to Load Case</h1>
        <p className="mt-3 text-lg text-slate-600">
          {error.message || 'Something went wrong while loading this case.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-emerald-900 px-4 py-2 text-white hover:bg-emerald-800"
          >
            Try Again
          </button>
          <Link
            href="/cases"
            className="rounded-lg bg-slate-200 px-4 py-2 text-slate-900 hover:bg-slate-300"
          >
            Back to Cases
          </Link>
        </div>
      </div>
    </main>
  )
}

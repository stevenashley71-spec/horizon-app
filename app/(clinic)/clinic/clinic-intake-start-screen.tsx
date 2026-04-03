'use client'

import { useState } from 'react'

import type { loadIntakeDraft } from '@/app/actions/intake/load-intake-draft'

import { ClinicIntakeForm } from './clinic-intake-form'

type ClinicIntakeData = Awaited<ReturnType<typeof loadIntakeDraft>>

export function ClinicIntakeStartScreen({ intake }: { intake: ClinicIntakeData }) {
  const [hasStarted, setHasStarted] = useState(false)

  if (hasStarted) {
    return <ClinicIntakeForm intake={intake} onExitToStart={() => setHasStarted(false)} />
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
        <section className="w-full rounded-[28px] bg-white p-10 text-center shadow-sm md:p-14">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Please review and complete this form
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-xl text-slate-500">
            This intake will guide you through the information Horizon needs to receive,
            review, and confirm this work order before submission.
          </p>
          <button
            type="button"
            onClick={() => setHasStarted(true)}
            className="mt-10 rounded-[22px] bg-emerald-900 px-10 py-5 text-2xl text-white transition-colors hover:bg-emerald-800"
          >
            Begin Intake
          </button>
        </section>
      </div>
    </main>
  )
}

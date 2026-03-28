'use client'

import { useState } from 'react'

export default function DisplayModeWrapper({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: (displayMode: boolean) => React.ReactNode
}) {
  const [displayMode, setDisplayMode] = useState(false)

  return (
    <div className={`mx-auto ${displayMode ? 'max-w-none space-y-8' : 'max-w-6xl space-y-6'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`${displayMode ? 'text-5xl md:text-6xl' : 'text-4xl md:text-5xl'} font-bold tracking-tight text-slate-900`}>
            {title}
          </h1>
          {!displayMode ? (
            <p className="mt-3 text-lg text-slate-500">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setDisplayMode((current) => !current)}
          className="rounded border px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
        >
          Display Mode
        </button>
      </div>

      <div className={displayMode ? 'space-y-8' : 'space-y-6'} data-display-mode={displayMode ? 'on' : 'off'}>
        {children(displayMode)}
      </div>
    </div>
  )
}

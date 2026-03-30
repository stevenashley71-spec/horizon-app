'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AutoRefresh() {
  const router = useRouter()
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)

  function handleRefreshNow() {
    router.refresh()
    setLastRefreshedAt(new Date())
  }

  useEffect(() => {
    setLastRefreshedAt(new Date())

    const intervalId = window.setInterval(() => {
      router.refresh()
      setLastRefreshedAt(new Date())
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [router])

  return (
    <div className="flex items-center justify-end gap-3 text-sm text-slate-500">
      <div>Last refreshed: {lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString() : '—'}</div>
      <button
        type="button"
        onClick={handleRefreshNow}
        className="rounded border px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 group-data-[display-mode=on]/workroom:hidden"
      >
        Refresh now
      </button>
    </div>
  )
}

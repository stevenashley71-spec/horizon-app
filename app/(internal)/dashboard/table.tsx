'use client'

import { useRouter } from 'next/navigation'

type DashboardRow = {
  id: string
  href: string
  caseNumber: string
  petName: string
  ownerName: string
  clinicName: string
  status: string
  statusClasses: string
  createdAt: string
}

export function DashboardCasesTable({ rows }: { rows: DashboardRow[] }) {
  const router = useRouter()

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <p className="text-lg text-slate-600">No active cases match the current filters.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead className="bg-slate-50">
          <tr className="text-left">
            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Case Number</th>
            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pet Name</th>
            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Owner Name</th>
            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Clinic</th>
            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Opened</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              onClick={() => router.push(row.href)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  router.push(row.href)
                }
              }}
              className="cursor-pointer border-t border-slate-200 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
            >
              <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.caseNumber}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.petName}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.ownerName}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.clinicName}</td>
              <td className="px-6 py-4 text-sm">
                <span className={`rounded-full px-3 py-1 font-medium ${row.statusClasses}`}>
                  {row.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

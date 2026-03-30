import { AdminSubnav } from './admin-subnav'

export function AdminSectionShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Admin Section
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Internal Administration
        </h2>
        <p className="mt-3 text-lg text-slate-500">
          Manage clinics, clinic users, products, and clinic-specific catalog controls.
        </p>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <AdminSubnav />
        </div>
      </section>

      {children}
    </div>
  )
}

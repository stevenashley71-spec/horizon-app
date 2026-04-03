import { getUserRole } from '@/lib/auth/get-user-role'
import { InternalPortalNav } from '@/app/(internal)/portal-nav'

export async function InternalPortalFrame({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const userRole = await getUserRole()

  if (!userRole || (userRole.role !== 'admin' && userRole.role !== 'horizon_staff')) {
    throw new Error('Internal user context is required')
  }

  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Horizon Internal
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Operations Portal
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            Operational queues, workflows, and internal administration.
          </p>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <InternalPortalNav userRole={userRole.role} />
          </div>
        </section>

        {children}
      </div>
    </main>
  )
}

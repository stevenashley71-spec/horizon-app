export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-100 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold text-slate-900">
          Horizon Pet Cremation System
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Internal operations platform for intake, scanning, workflow, and clinic updates.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">Clinic Portal</h2>
            <p className="mt-2 text-slate-600">
              New work orders, case status, and print view.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">Staff Scan</h2>
            <p className="mt-2 text-slate-600">
              Scan-to-load cases, workflow steps, and location tracking.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">Admin</h2>
            <p className="mt-2 text-slate-600">
              Clinics, pricing, products, workflows, and assignments.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

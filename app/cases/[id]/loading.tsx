export default function CaseDetailLoading() {
  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="mb-6 h-10 w-28 rounded-lg bg-slate-200" />
        <div className="mb-3 h-12 w-72 rounded bg-slate-200" />
        <div className="h-6 w-56 rounded bg-slate-100" />

        <div className="mt-8 space-y-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <section key={index} className="rounded-[28px] bg-white p-8 shadow-sm">
              <div className="mb-6 h-8 w-48 rounded bg-slate-200" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-16 rounded bg-slate-100" />
                <div className="h-16 rounded bg-slate-100" />
                <div className="h-16 rounded bg-slate-100" />
                <div className="h-16 rounded bg-slate-100" />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}

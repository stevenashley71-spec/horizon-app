export function ClinicAccessBlocked({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
      <div className="mx-auto max-w-5xl rounded-[28px] bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Clinic Access Unavailable
        </h1>
        <p className="mt-3 text-xl text-slate-500">{message}</p>
      </div>
    </main>
  )
}

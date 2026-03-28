import { createServerSupabase } from '@/lib/supabase/server'

export default async function TestPage() {
  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Supabase Test</h1>

      {error && (
        <pre className="mt-4 text-red-600">
          {JSON.stringify(error, null, 2)}
        </pre>
      )}

      <pre className="mt-4">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  )
}
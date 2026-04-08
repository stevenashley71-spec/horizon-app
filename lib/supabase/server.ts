import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseHost = new URL(supabaseUrl).hostname.split('.')[0]
const storageKey = `sb-${supabaseHost}-auth-token`

export async function createServerAuthSupabase() {
  const cookieStore = await cookies()

  const cookieStorage = {
    getItem(key: string) {
      return cookieStore.get(key)?.value ?? null
    },
    setItem(key: string, value: string) {
      void key
      void value
    },
    removeItem(key: string) {
      void key
    },
  }

  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        storageKey,
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
        storage: cookieStorage,
      },
    }
  )
}

export function createServiceRoleSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function createServerSupabase() {
  return createServerAuthSupabase()
}

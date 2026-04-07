import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseHost = new URL(supabaseUrl).hostname.split('.')[0]
const storageKey = `sb-${supabaseHost}-auth-token`

export async function createServerAuthSupabase() {
  const cookieStore = await cookies()
  const mutableCookieStore = cookieStore as typeof cookieStore & {
    set?: (
      input:
        | string
        | {
            name: string
            value: string
            path?: string
            maxAge?: number
          }
    ) => void
  }

  const cookieStorage = {
    getItem(key: string) {
      return cookieStore.get(key)?.value ?? null
    },
    setItem(key: string, value: string) {
      if (!mutableCookieStore.set) {
        return
      }

      mutableCookieStore.set({
        name: key,
        value,
        path: '/',
      })
    },
    removeItem(key: string) {
      if (!mutableCookieStore.set) {
        return
      }

      mutableCookieStore.set({
        name: key,
        value: '',
        path: '/',
        maxAge: 0,
      })
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

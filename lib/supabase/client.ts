import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseHost = new URL(supabaseUrl).hostname.split('.')[0]
const storageKey = `sb-${supabaseHost}-auth-token`

const cookieStorage = {
  getItem(key: string) {
    if (typeof document === 'undefined') {
      return null
    }

    const cookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${key}=`))

    if (!cookie) {
      return null
    }

    return decodeURIComponent(cookie.slice(key.length + 1))
  },
  setItem(key: string, value: string) {
    if (typeof document === 'undefined') {
      return
    }

    document.cookie = `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
  },
  removeItem(key: string) {
    if (typeof document === 'undefined') {
      return
    }

    document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax`
  },
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storageKey,
      storage: cookieStorage,
    },
  }
)

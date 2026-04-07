import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseHost = new URL(supabaseUrl).hostname.split('.')[0]
const storageKey = `sb-${supabaseHost}-auth-token`
const isDevelopment = process.env.NODE_ENV === 'development'

function getDevelopmentCookieValue(value: string) {
  try {
    const parsedValue = JSON.parse(value) as unknown

    if (
      parsedValue &&
      typeof parsedValue === 'object' &&
      'access_token' in parsedValue &&
      typeof parsedValue.access_token === 'string'
    ) {
      return JSON.stringify({ access_token: parsedValue.access_token })
    }
  } catch {
    return value
  }

  return value
}

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

    const cookieValue = isDevelopment ? getDevelopmentCookieValue(value) : value

    document.cookie = `${key}=${encodeURIComponent(cookieValue)}; Path=/; Max-Age=31536000; SameSite=Lax`
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

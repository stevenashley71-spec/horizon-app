import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

async function getSupabaseAccessToken() {
  const cookieStore = await cookies()
  const authCookie = cookieStore
    .getAll()
    .find((cookie) => cookie.name.includes('auth-token'))

  if (!authCookie?.value) {
    return null
  }

  try {
    const parsedCookie = JSON.parse(decodeURIComponent(authCookie.value))

    if (Array.isArray(parsedCookie) && typeof parsedCookie[0] === 'string') {
      return parsedCookie[0]
    }

    if (
      parsedCookie &&
      typeof parsedCookie === 'object' &&
      'access_token' in parsedCookie &&
      typeof parsedCookie.access_token === 'string'
    ) {
      return parsedCookie.access_token
    }
  } catch {
    return null
  }

  return null
}

export async function createServerAuthSupabase() {
  const accessToken = await getSupabaseAccessToken()

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: accessToken
        ? {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        : undefined,
    }
  )
}

export function createServiceRoleSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function createServerSupabase() {
  return createServiceRoleSupabase()
}

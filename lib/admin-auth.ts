import { createServerAuthSupabase } from '@/lib/supabase/server'

export type TemporaryHorizonAdmin = {
  userId: string
  email: string
}

type TemporaryHorizonAdminResult =
  | {
      kind: 'ok'
      admin: TemporaryHorizonAdmin
    }
  | {
      kind: 'blocked'
      message: string
    }

async function getAuthenticatedAdminUser() {
  const supabase = await createServerAuthSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user ?? null
}

export async function getTemporaryHorizonAdminResult(): Promise<TemporaryHorizonAdminResult | null> {
  const user = await getAuthenticatedAdminUser()

  if (!user) {
    return null
  }

  const rawAllowedEmail = process.env.HORIZON_ADMIN_EMAIL ?? ''
  const rawUserEmail = user.email ?? ''
  const allowedEmail = rawAllowedEmail.trim().toLowerCase()
  const userEmail = rawUserEmail.trim().toLowerCase()

  console.log('Temporary Horizon Admin email check', {
    userEmail: rawUserEmail,
    allowedEmail: rawAllowedEmail,
  })

  if (!allowedEmail) {
    return {
      kind: 'blocked',
      message: 'Temporary Horizon Admin access is not configured.',
    }
  }

  if (!userEmail || userEmail !== allowedEmail) {
    return {
      kind: 'blocked',
      message: 'This account is not allowed to access Horizon Admin testing tools.',
    }
  }

  return {
    kind: 'ok',
    admin: {
      userId: user.id,
      email: user.email ?? '',
    },
  }
}

export async function requireTemporaryHorizonAdmin() {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    throw new Error('Authentication required')
  }

  if (adminResult.kind === 'blocked') {
    throw new Error(adminResult.message)
  }

  return adminResult.admin
}

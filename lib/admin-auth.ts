import { getUserRole } from '@/lib/auth/get-user-role'

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

export async function getTemporaryHorizonAdminResult(): Promise<TemporaryHorizonAdminResult | null> {
  const userRole = await getUserRole()

  if (!userRole) {
    return null
  }

  if (userRole.role !== 'admin') {
    return {
      kind: 'blocked',
      message: 'This account is not allowed to access Horizon Admin testing tools.',
    }
  }

  return {
    kind: 'ok',
    admin: {
      userId: userRole.userId,
      email: userRole.email ?? '',
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

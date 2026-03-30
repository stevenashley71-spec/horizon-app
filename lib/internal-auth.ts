import { getUserRole } from '@/lib/auth/get-user-role'

export type InternalHorizonUser = {
  userId: string
  email: string | null
  role: 'admin' | 'horizon_staff'
}

type InternalHorizonUserResult =
  | {
      kind: 'ok'
      user: InternalHorizonUser
    }
  | {
      kind: 'blocked'
      message: string
    }

export async function getInternalHorizonUserResult(): Promise<InternalHorizonUserResult | null> {
  const userRole = await getUserRole()

  if (!userRole) {
    return null
  }

  if (userRole.role !== 'admin' && userRole.role !== 'horizon_staff') {
    return {
      kind: 'blocked',
      message: 'This account is not allowed to access internal Horizon tools.',
    }
  }

  return {
    kind: 'ok',
    user: {
      userId: userRole.userId,
      email: userRole.email,
      role: userRole.role,
    },
  }
}

export async function requireInternalHorizonUser() {
  const userResult = await getInternalHorizonUserResult()

  if (!userResult) {
    throw new Error('Authentication required')
  }

  if (userResult.kind === 'blocked') {
    throw new Error(userResult.message)
  }

  return userResult.user
}

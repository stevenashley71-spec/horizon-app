'use server'

import { getUserRole } from '@/lib/auth/get-user-role'

export async function validateDirectKioskPin(pin: string): Promise<boolean> {
  const userRole = await getUserRole()

  if (!userRole || (userRole.role !== 'admin' && userRole.role !== 'horizon_staff')) {
    return false
  }

  const normalizedPin = pin.trim()
  const expectedPin = (process.env.DIRECT_KIOSK_PIN ?? '').trim()

  if (!normalizedPin || !expectedPin) {
    return false
  }

  return normalizedPin === expectedPin
}

import { redirect } from 'next/navigation'

import { getUserRole } from '@/lib/auth/get-user-role'

export default async function Home() {
  const userRole = await getUserRole()

  if (!userRole) {
    redirect('/clinic/login')
  }

  if (userRole.role === 'clinic_user') {
    redirect('/clinic')
  }

  redirect('/dashboard')
}

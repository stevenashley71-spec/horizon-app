import { redirect } from 'next/navigation'

import { getUserRole } from '@/lib/auth/get-user-role'

import { ClinicLoginForm } from './login-form'

export default async function ClinicLoginPage() {
  const userRole = await getUserRole()

  if (userRole?.role === 'clinic_user') {
    redirect('/clinic')
  }

  if (userRole?.role === 'admin' || userRole?.role === 'horizon_staff') {
    redirect('/dashboard')
  }

  return <ClinicLoginForm />
}

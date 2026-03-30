import { redirect } from 'next/navigation'

import { getUserRole } from '@/lib/auth/get-user-role'

import { AdminLoginForm } from './login-form'

export default async function AdminLoginPage() {
  const userRole = await getUserRole()

  if (userRole?.role === 'clinic_user') {
    redirect('/clinic')
  }

  if (userRole?.role === 'admin' || userRole?.role === 'horizon_staff') {
    redirect('/dashboard')
  }

  return <AdminLoginForm />
}

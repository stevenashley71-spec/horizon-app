'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase/client'

export function LogoutButton({
  loginPath,
  className,
}: {
  loginPath: string
  className: string
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLogout() {
    setIsSubmitting(true)
    await supabase.auth.signOut()
    router.replace(loginPath)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      className={className}
    >
      {isSubmitting ? 'Signing out...' : 'Logout'}
    </button>
  )
}

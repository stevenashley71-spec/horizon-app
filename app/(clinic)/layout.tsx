import { redirect } from 'next/navigation'

import { ClinicAccessBlocked } from '@/app/components/clinic-access-blocked'
import { getUserRole } from '@/lib/auth/get-user-role'
import { createServerSupabase } from '@/lib/supabase/server'

import { ClinicPortalNav } from './portal-nav'

function getClinicInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

async function getClinicLogoUrl(logoPath: string | null) {
  if (!logoPath) {
    return null
  }

  const supabase = await createServerSupabase()
  const { data } = supabase.storage.from('clinic-logos').getPublicUrl(logoPath)
  return data.publicUrl
}

export default async function ClinicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const userRole = await getUserRole()

  if (!userRole) {
    redirect('/clinic/login')
  }

  if (userRole.role !== 'clinic_user') {
    redirect('/dashboard')
  }

  const supabase = await createServerSupabase()
  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, name, logo_path, is_active')
    .eq('id', userRole.clinicId)
    .single()

  if (clinicError || !clinic || !clinic.is_active) {
    return <ClinicAccessBlocked message="Your clinic account is inactive." />
  }

  const clinicLogoUrl = await getClinicLogoUrl(clinic.logo_path)
  const clinicInitials = getClinicInitials(clinic.name)

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-[#e7ece9] text-3xl font-bold text-[#23423a]">
                {clinicLogoUrl ? (
                  <img
                    src={clinicLogoUrl}
                    alt={`${clinic.name} logo`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  clinicInitials
                )}
              </div>

              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Clinic Portal
                </div>
                <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                  {clinic.name} Aftercare Portal
                </h1>
                <p className="mt-3 text-xl text-slate-500">
                  Powered by Horizon Pet Cremation
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <ClinicPortalNav />
          </div>
        </section>

        {children}
      </div>
    </main>
  )
}

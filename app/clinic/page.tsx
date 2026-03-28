import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createServerSupabase } from '@/lib/supabase/server'

import { ClinicIntakeForm } from './clinic-intake-form'

type ClinicRow = {
  id: string
  name: string
  logo_path: string | null
  is_active: boolean
}

function getClinicInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function getClinicLogoUrl(logoPath: string | null) {
  if (!logoPath) {
    return null
  }

  const supabase = createServerSupabase()
  const { data } = supabase.storage.from('clinic-logos').getPublicUrl(logoPath)
  return data.publicUrl
}

async function getAuthenticatedUserId() {
  const cookieStore = await cookies()
  const authCookie = cookieStore
    .getAll()
    .find((cookie) => cookie.name.includes('auth-token'))

  if (!authCookie?.value) {
    return null
  }

  let accessToken: string | null = null

  try {
    const parsedCookie = JSON.parse(decodeURIComponent(authCookie.value))

    if (Array.isArray(parsedCookie) && typeof parsedCookie[0] === 'string') {
      accessToken = parsedCookie[0]
    } else if (
      parsedCookie &&
      typeof parsedCookie === 'object' &&
      'access_token' in parsedCookie &&
      typeof parsedCookie.access_token === 'string'
    ) {
      accessToken = parsedCookie.access_token
    }
  } catch {
    accessToken = null
  }

  if (!accessToken) {
    return null
  }

  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken)

  return user?.id ?? null
}

export default async function ClinicPage() {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    redirect('/clinic/login')
  }

  const supabase = createServerSupabase()
  const { data: clinicUser, error: clinicUserError } = await supabase
    .from('clinic_users')
    .select('clinic_id')
    .eq('user_id', userId)
    .single()

  if (clinicUserError || !clinicUser) {
    return (
      <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-5xl rounded-[28px] bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Clinic Access Unavailable
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            Your authenticated account is not linked to an active clinic portal yet.
          </p>
        </div>
      </main>
    )
  }

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, name, logo_path, is_active')
    .eq('id', clinicUser.clinic_id)
    .single()

  if (clinicError || !clinic || !clinic.is_active) {
    return (
      <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-5xl rounded-[28px] bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Clinic Access Unavailable
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            The clinic linked to this account is inactive or could not be loaded.
          </p>
        </div>
      </main>
    )
  }

  const clinicContext = clinic as ClinicRow
  const clinicLogoUrl = getClinicLogoUrl(clinicContext.logo_path)
  const clinicInitials = getClinicInitials(clinicContext.name)

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-[#e7ece9] text-3xl font-bold text-[#23423a]">
                {clinicLogoUrl ? (
                  <img
                    src={clinicLogoUrl}
                    alt={`${clinicContext.name} logo`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  clinicInitials
                )}
              </div>

              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                  {clinicContext.name} Aftercare Portal
                </h1>
              </div>
            </div>

            <div className="text-lg font-medium text-slate-500 md:text-right">
              Powered by Horizon Pet Cremation
            </div>
          </div>
        </section>

        <ClinicIntakeForm
          clinicContext={{ id: clinicContext.id, name: clinicContext.name }}
          fallbackClinics={[]}
          allowDevClinicSelection={false}
          renderWithinPage
        />
      </div>
    </main>
  )
}

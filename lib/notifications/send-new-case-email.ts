import { Resend } from 'resend'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type SendNewCaseEmailInput = {
  caseNumber: string
  clinicName: string
  petName: string
}

type HorizonSettingsRow = {
  id: boolean
  notification_email: string | null
  notification_phone: string | null
}

export async function sendNewCaseEmail(input: SendNewCaseEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fallbackEmail = process.env.HORIZON_ADMIN_EMAIL?.trim()

  if (!apiKey) {
    console.error('Unable to send new case email: missing RESEND_API_KEY.')
    return
  }

  try {
    const supabase = createServiceRoleSupabase()
    const { data: horizonSettings, error: horizonSettingsError } = await supabase
      .from('horizon_settings')
      .select('id, notification_email, notification_phone')
      .eq('id', true)
      .maybeSingle()

    if (horizonSettingsError) {
      console.error('Unable to load Horizon notification settings.', horizonSettingsError)
    }

    const typedHorizonSettings = (horizonSettings as HorizonSettingsRow | null) ?? null
    const configuredEmail = typedHorizonSettings?.notification_email?.trim() ?? ''
    const recipientEmail = configuredEmail || fallbackEmail || ''

    if (!recipientEmail) {
      console.error(
        'Unable to send new case email: no Horizon notification email is configured and no HORIZON_ADMIN_EMAIL fallback is configured.'
      )
      return
    }

    const resend = new Resend(apiKey)

    await resend.emails.send({
      from: 'Horizon Pet Cremation <onboarding@resend.dev>',
      to: recipientEmail,
      subject: `New Case Submitted - ${input.caseNumber}`,
      text: [
        'A new case has been submitted.',
        '',
        `Case Number: ${input.caseNumber}`,
        `Clinic Name: ${input.clinicName}`,
        `Pet Name: ${input.petName}`,
      ].join('\n'),
    })
  } catch (error) {
    console.error('Failed to send new case email.', error)
  }
}

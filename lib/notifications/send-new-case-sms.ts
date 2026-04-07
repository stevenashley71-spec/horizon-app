import 'server-only'

import twilio from 'twilio'

import { createServiceRoleSupabase } from '@/lib/supabase/server'

type SendNewCaseSmsInput = {
  caseNumber: string
  clinicName: string
  petName: string | null
}

type HorizonSettingsRow = {
  id: boolean
  notification_sms_phone: string | null
}

export async function sendNewCaseSms(input: SendNewCaseSmsInput): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const fromPhone = process.env.TWILIO_FROM_PHONE?.trim()

  if (!accountSid || !authToken || !fromPhone) {
    return
  }

  try {
    const supabase = createServiceRoleSupabase()
    const { data: horizonSettings, error: horizonSettingsError } = await supabase
      .from('horizon_settings')
      .select('id, notification_sms_phone')
      .eq('id', true)
      .maybeSingle()

    if (horizonSettingsError) {
      console.error('Unable to load Horizon SMS notification settings.', horizonSettingsError)
      return
    }

    const typedHorizonSettings = (horizonSettings as HorizonSettingsRow | null) ?? null
    const toPhone = typedHorizonSettings?.notification_sms_phone?.trim() ?? ''

    if (!toPhone) {
      return
    }

    const client = twilio(accountSid, authToken)
    const normalizedPetName = input.petName?.trim() ? input.petName.trim() : 'Unknown'
    const body = `New case submitted: ${input.caseNumber}, Clinic: ${input.clinicName}, Pet: ${normalizedPetName}`

    const result = await client.messages.create({
      to: toPhone,
      from: fromPhone,
      body,
    })
  } catch (error) {
    console.error('Failed to send new case SMS.', error)
  }
}

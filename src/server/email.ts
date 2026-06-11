/**
 * Outbound email (PLAN.md task 9.2) via Cloudflare Email Workers: the
 * `send_email` binding's structured send(). Until Email Routing / sender
 * verification is set up on the modelschemas.com zone, sends fail with
 * E_SENDER_NOT_VERIFIED — every failure (and the no-binding local case)
 * falls back to a structured console line so the OTP is observable in dev
 * output and `wrangler tail` instead of silently dropping a sign-in.
 */

export interface OutboundEmail {
  to: string
  subject: string
  text: string
}

export type EmailSender = (email: OutboundEmail) => Promise<void>

export const EMAIL_FROM = 'login@modelschemas.com'

/** Minimal shape of the send_email binding's structured API. */
export interface SendEmailBinding {
  send: (message: {
    to: string
    from: string
    subject: string
    text: string
  }) => Promise<unknown>
}

function logEmail(email: OutboundEmail, mode: string): void {
  console.log(JSON.stringify({ job: 'email', mode, ...email }))
}

export function createEmailSender(binding?: SendEmailBinding): EmailSender {
  if (!binding) {
    return (email) => {
      logEmail(email, 'dev-log')
      return Promise.resolve()
    }
  }
  return async (email) => {
    try {
      await binding.send({
        to: email.to,
        from: EMAIL_FROM,
        subject: email.subject,
        text: email.text,
      })
    } catch (error) {
      logEmail(email, `send-failed: ${String(error)}`)
    }
  }
}

export function otpEmail(email: string, otp: string): OutboundEmail {
  return {
    to: email,
    subject: `${otp} is your modelschemas sign-in code`,
    text: `Your modelschemas sign-in code is ${otp}. It expires in 5 minutes.\n\nIf you didn't request this, ignore this email.`,
  }
}

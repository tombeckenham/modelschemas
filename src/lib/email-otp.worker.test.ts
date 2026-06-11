import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'

import { getDb } from '../db/index.ts'
import { createAuth } from './auth.ts'

function makeAuth(captured: Array<{ email: string; otp: string }>) {
  return createAuth(getDb(env), {
    secret: 'vitest-only-better-auth-secret-0123456789',
    baseUrl: 'http://otp.test',
    sendOtp: (data) => {
      captured.push(data)
      return Promise.resolve()
    },
  })
}

describe('email OTP sign-in (task 9.2)', () => {
  it('issues a code via the injected sender and signs the user in', async () => {
    const captured: Array<{ email: string; otp: string }> = []
    const auth = makeAuth(captured)

    await auth.api.sendVerificationOTP({
      body: { email: 'human@example.com', type: 'sign-in' },
    })
    expect(captured).toHaveLength(1)
    expect(captured[0]?.email).toBe('human@example.com')
    expect(captured[0]?.otp).toMatch(/^\d{6}$/)

    const signedIn = await auth.api.signInEmailOTP({
      body: { email: 'human@example.com', otp: captured[0]?.otp ?? '' },
    })
    expect(signedIn.token).toBeTruthy()
    expect(signedIn.user.email).toBe('human@example.com')

    // The bearer plugin accepts the session token for follow-up requests.
    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${signedIn.token}` }),
    })
    expect(session?.user.email).toBe('human@example.com')
  })

  it('rejects wrong codes', async () => {
    const captured: Array<{ email: string; otp: string }> = []
    const auth = makeAuth(captured)
    await auth.api.sendVerificationOTP({
      body: { email: 'human2@example.com', type: 'sign-in' },
    })
    const wrong = captured[0]?.otp === '000000' ? '111111' : '000000'
    // Via the HTTP handler: the server API throws AND leaves a floating
    // rejection in better-auth's dispatch layer; the handler returns a 400.
    const response = await auth.handler(
      new Request('http://otp.test/api/auth/sign-in/email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'human2@example.com', otp: wrong }),
      }),
    )
    expect(response.status).toBe(400)
    const body = (await response.json()) as { code?: string }
    expect(body.code).toBe('INVALID_OTP')
  })
})

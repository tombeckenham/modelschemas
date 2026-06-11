import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'

import { getDb } from '../db/index.ts'
import { requireAgent } from '../server/require-agent.ts'
import { createAuth } from './auth.ts'

const BASE = 'http://account.test'

async function signedInSession() {
  const captured: Array<{ email: string; otp: string }> = []
  const auth = createAuth(getDb(env), {
    secret: 'vitest-only-better-auth-secret-0123456789',
    baseUrl: BASE,
    sendOtp: (data) => {
      captured.push(data)
      return Promise.resolve()
    },
  })
  const email = `keys-${crypto.randomUUID().slice(0, 8)}@example.com`
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const signedIn = await auth.api.signInEmailOTP({
    body: { email, otp: captured[0]?.otp ?? '' },
  })
  return {
    auth,
    email,
    headers: new Headers({ authorization: `Bearer ${signedIn.token}` }),
  }
}

describe('human API-key lifecycle (task 9.3)', () => {
  it('creates, lists, uses, and revokes a key within the session', async () => {
    const { auth, headers } = await signedInSession()

    // Create (session-authed — no explicit userId).
    const created = await auth.api.createApiKey({
      body: { name: 'laptop key', expiresIn: 30 * 86_400 },
      headers,
    })
    expect(created.key).toBeTruthy()
    expect(created.name).toBe('laptop key')
    expect(created.expiresAt).not.toBeNull()

    // List shows it without the secret value.
    const listed = await auth.api.listApiKeys({ headers })
    expect(listed.apiKeys.map((k) => k.id)).toContain(created.id)
    expect(JSON.stringify(listed)).not.toContain(created.key)

    // The key authenticates like any agent credential.
    const authed = await requireAgent(
      auth,
      new Request(`${BASE}/v1/agents/me`, {
        headers: { authorization: `Bearer ${created.key}` },
      }),
    )
    expect(authed.ok).toBe(true)
    if (authed.ok) expect(authed.principal.kind).toBe('api-key')

    // Revoke → the key stops working.
    await auth.api.deleteApiKey({ body: { keyId: created.id }, headers })
    const afterRevoke = await requireAgent(
      auth,
      new Request(`${BASE}/v1/agents/me`, {
        headers: { authorization: `Bearer ${created.key}` },
      }),
    )
    expect(afterRevoke.ok).toBe(false)
    if (!afterRevoke.ok) expect(afterRevoke.response.status).toBe(401)
    expect(
      (await auth.api.listApiKeys({ headers })).apiKeys.map((k) => k.id),
    ).not.toContain(created.id)
  })

  it('scopes keys to their owner session', async () => {
    const alice = await signedInSession()
    const bob = await signedInSession()

    const aliceKey = await alice.auth.api.createApiKey({
      body: { name: 'alice key' },
      headers: alice.headers,
    })

    // Bob cannot see or revoke Alice's key.
    const bobList = await bob.auth.api.listApiKeys({ headers: bob.headers })
    expect(bobList.apiKeys.map((k) => k.id)).not.toContain(aliceKey.id)
    await expect(
      bob.auth.api.deleteApiKey({
        body: { keyId: aliceKey.id },
        headers: bob.headers,
      }),
    ).rejects.toThrow()

    // Alice's key still works.
    const stillWorks = await requireAgent(
      alice.auth,
      new Request(`${BASE}/v1/agents/me`, {
        headers: { authorization: `Bearer ${aliceKey.key}` },
      }),
    )
    expect(stillWorks.ok).toBe(true)
  })
})

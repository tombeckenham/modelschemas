import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'

import { getDb } from '../db/index.ts'
import { createAuth } from '../lib/auth.ts'
import { parseRegisterKeyBody, registerKeyAgent } from './agents-api.ts'
import { requireAgent } from './require-agent.ts'

const makeAuth = () =>
  createAuth(getDb(env), {
    secret: 'vitest-only-better-auth-secret-0123456789',
    baseUrl: 'http://keys.test',
  })

const keyedRequest = (headers: Record<string, string>) =>
  new Request('http://keys.test/v1/agents/me', { headers })

describe('registerKeyAgent + API-key requireAgent', () => {
  it('registers and authenticates with the returned key', async () => {
    const auth = makeAuth()
    const outcome = await registerKeyAgent(auth, getDb(env), {
      name: 'Keyed Agent',
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.key).toBeTruthy()
    expect(outcome.result.note).toContain('once')

    const viaBearer = await requireAgent(
      auth,
      keyedRequest({ authorization: `Bearer ${outcome.result.key}` }),
    )
    expect(viaBearer.ok).toBe(true)
    if (viaBearer.ok) {
      expect(viaBearer.principal.kind).toBe('api-key')
      expect(viaBearer.principal.userId).toBe(outcome.result.userId)
    }

    // X-Api-Key works too, and keys satisfy public capabilities.
    const viaHeader = await requireAgent(
      auth,
      keyedRequest({ 'x-api-key': outcome.result.key }),
      { capability: 'manage_subscriptions' },
    )
    expect(viaHeader.ok).toBe(true)

    // ...but never privileged/unknown capabilities (no silent bypass).
    const privileged = await requireAgent(
      auth,
      keyedRequest({ 'x-api-key': outcome.result.key }),
      { capability: 'syncProvider' },
    )
    expect(privileged.ok).toBe(false)
    if (!privileged.ok) {
      expect(privileged.response.status).toBe(403)
      const body = (await privileged.response.json()) as {
        error: { code: string }
      }
      expect(body.error.code).toBe('capability_not_granted')
    }
  })

  it('rejects invalid keys with a 401', async () => {
    const auth = makeAuth()
    const result = await requireAgent(
      auth,
      keyedRequest({ authorization: 'Bearer ms_not_a_real_key' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      const body = (await result.response.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_api_key')
    }
  })

  it('uses a custom email when provided and validates bodies', async () => {
    const auth = makeAuth()
    const outcome = await registerKeyAgent(auth, getDb(env), {
      name: 'Mail Agent',
      email: 'mail-agent@example.com',
    })
    expect(outcome.ok).toBe(true)

    // Duplicate email → structured failure, not a throw.
    const dup = await registerKeyAgent(auth, getDb(env), {
      name: 'Mail Agent 2',
      email: 'mail-agent@example.com',
    })
    expect(dup).toMatchObject({ ok: false, status: 409 })

    expect(parseRegisterKeyBody({ name: 'x' })).toEqual({
      name: 'x',
      email: undefined,
    })
    expect(parseRegisterKeyBody({ name: '  ' })).toBeNull()
    expect(parseRegisterKeyBody({})).toBeNull()
    expect(parseRegisterKeyBody({ name: 'x', email: 5 })).toBeNull()
  })
})

describe('agentsMe (task 5.5)', () => {
  it('reports identity, grants, limits, and usage for an API key', async () => {
    const { agentsMe } = await import('./agents-api.ts')
    const auth = makeAuth()
    const registered = await registerKeyAgent(auth, getDb(env), {
      name: 'Me Agent',
    })
    expect(registered.ok).toBe(true)
    if (!registered.ok) return

    const response = await agentsMe(
      auth,
      env.SCHEMA_CACHE,
      keyedRequest({ authorization: `Bearer ${registered.result.key}` }),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      agent: { kind: string; userId: string }
      grants: Array<string>
      limits: { requestsPerHour: number }
      usage: { limit: number; remaining: number; resetAt: number }
    }
    expect(body.agent.kind).toBe('api-key')
    expect(body.agent.userId).toBe(registered.result.userId)
    expect(body.grants).toContain('getSchema')
    expect(body.limits.requestsPerHour).toBe(5000)
    expect(body.usage.limit).toBe(5000)
    expect(body.usage.resetAt).toBeGreaterThan(0)
  })

  it('401s without credentials', async () => {
    const { agentsMe } = await import('./agents-api.ts')
    const response = await agentsMe(
      makeAuth(),
      env.SCHEMA_CACHE,
      keyedRequest({}),
    )
    expect(response.status).toBe(401)
  })
})

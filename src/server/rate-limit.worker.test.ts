import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'

import { getDb } from '../db/index.ts'
import { createAuth } from '../lib/auth.ts'
import { registerKeyAgent } from './agents-api.ts'
import {
  ANONYMOUS_LIMIT,
  checkRateLimit,
  enforceRateLimit,
} from './rate-limit.ts'

const NOW = 1_781_150_000

const makeAuth = () =>
  createAuth(getDb(env), {
    secret: 'vitest-only-better-auth-secret-0123456789',
    baseUrl: 'http://rl.test',
  })

const anonRequest = (ip: string) =>
  new Request('http://rl.test/v1/models', {
    headers: { 'cf-connecting-ip': ip },
  })

describe('checkRateLimit', () => {
  it('counts within a fixed window and resets in the next one', async () => {
    const first = await checkRateLimit(env.SCHEMA_CACHE, 'unit-a', 2, 3600, NOW)
    expect(first).toMatchObject({ allowed: true, remaining: 1 })
    const second = await checkRateLimit(
      env.SCHEMA_CACHE,
      'unit-a',
      2,
      3600,
      NOW + 10,
    )
    expect(second).toMatchObject({ allowed: true, remaining: 0 })
    const third = await checkRateLimit(
      env.SCHEMA_CACHE,
      'unit-a',
      2,
      3600,
      NOW + 20,
    )
    expect(third.allowed).toBe(false)
    expect(third.resetAt).toBe(Math.floor(NOW / 3600) * 3600 + 3600)

    // Next window: fresh counter.
    const nextWindow = await checkRateLimit(
      env.SCHEMA_CACHE,
      'unit-a',
      2,
      3600,
      NOW + 3600,
    )
    expect(nextWindow.allowed).toBe(true)
  })
})

describe('enforceRateLimit (acceptance: anonymous window exhaustion)', () => {
  it('allows 60 anonymous requests then 429s with Retry-After', async () => {
    const auth = makeAuth()
    const ip = '198.51.100.7'
    for (let i = 0; i < ANONYMOUS_LIMIT.limit; i++) {
      const limited = await enforceRateLimit(
        auth,
        env.SCHEMA_CACHE,
        anonRequest(ip),
        NOW + i,
      )
      expect(limited).toBeNull()
    }

    const limited = await enforceRateLimit(
      auth,
      env.SCHEMA_CACHE,
      anonRequest(ip),
      NOW + 100,
    )
    expect(limited).not.toBeNull()
    expect(limited?.status).toBe(429)
    expect(Number(limited?.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(limited?.headers.get('x-ratelimit-remaining')).toBe('0')
    const body = (await limited?.json()) as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')

    // A different IP is unaffected.
    const other = await enforceRateLimit(
      auth,
      env.SCHEMA_CACHE,
      anonRequest('198.51.100.8'),
      NOW + 100,
    )
    expect(other).toBeNull()
  })

  it('gives authenticated API keys their own (larger) bucket', async () => {
    const auth = makeAuth()
    const ip = '198.51.100.9'
    // Exhaust the anonymous bucket for this IP.
    for (let i = 0; i < ANONYMOUS_LIMIT.limit; i++) {
      await enforceRateLimit(auth, env.SCHEMA_CACHE, anonRequest(ip), NOW + i)
    }
    expect(
      await enforceRateLimit(auth, env.SCHEMA_CACHE, anonRequest(ip), NOW + 99),
    ).not.toBeNull()

    // Same IP with a valid API key: separate authenticated bucket → allowed.
    const registered = await registerKeyAgent(auth, getDb(env), {
      name: 'RL Key Agent',
    })
    expect(registered.ok).toBe(true)
    if (!registered.ok) return
    const keyed = new Request('http://rl.test/v1/models', {
      headers: {
        'cf-connecting-ip': ip,
        authorization: `Bearer ${registered.result.key}`,
      },
    })
    expect(
      await enforceRateLimit(auth, env.SCHEMA_CACHE, keyed, NOW + 99),
    ).toBeNull()
  })
})

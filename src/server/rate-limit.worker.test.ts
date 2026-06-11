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
        getDb(env),
        env.SCHEMA_CACHE,
        anonRequest(ip),
        NOW + i,
      )
      expect(limited).toBeNull()
    }

    const limited = await enforceRateLimit(
      auth,
      getDb(env),
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
      getDb(env),
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
      await enforceRateLimit(
        auth,
        getDb(env),
        env.SCHEMA_CACHE,
        anonRequest(ip),
        NOW + i,
      )
    }
    expect(
      await enforceRateLimit(
        auth,
        getDb(env),
        env.SCHEMA_CACHE,
        anonRequest(ip),
        NOW + 99,
      ),
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
      await enforceRateLimit(
        auth,
        getDb(env),
        env.SCHEMA_CACHE,
        keyed,
        NOW + 99,
      ),
    ).toBeNull()
  })
})

describe('agent JWT buckets (signature-verified, no jti consumption)', () => {
  it('forged JWTs never upgrade past the anonymous IP bucket', async () => {
    const auth = makeAuth()
    const ip = '198.51.100.20'
    const forged = (sub: string) => {
      const b64 = (value: object) =>
        btoa(JSON.stringify(value))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
      return `${b64({ alg: 'EdDSA', typ: 'agent+jwt' })}.${b64({ sub })}.AAAA`
    }

    // Exhaust the IP window using forged JWTs with ROTATING subs — if
    // unverified claims granted authenticated buckets, this would never 429.
    for (let i = 0; i < ANONYMOUS_LIMIT.limit; i++) {
      const request = new Request('http://rl.test/v1/models', {
        headers: {
          'cf-connecting-ip': ip,
          authorization: `Bearer ${forged(`spoof-${String(i)}`)}`,
        },
      })
      await enforceRateLimit(
        auth,
        getDb(env),
        env.SCHEMA_CACHE,
        request,
        NOW + i,
      )
    }
    const final = new Request('http://rl.test/v1/models', {
      headers: {
        'cf-connecting-ip': ip,
        authorization: `Bearer ${forged('spoof-final')}`,
      },
    })
    const limited = await enforceRateLimit(
      auth,
      getDb(env),
      env.SCHEMA_CACHE,
      final,
      NOW + 99,
    )
    expect(limited?.status).toBe(429)
  })

  it('a properly signed agent JWT gets the authenticated bucket', async () => {
    const { SignJWT, exportJWK, generateKeyPair } = await import('jose')
    const db = getDb(env)
    const auth = makeAuth()

    const keys = await generateKeyPair('Ed25519', { extractable: true })
    const { agent, agentHost } = await import('../db/schema.ts')
    await db.insert(agentHost).values({
      id: 'rl-host',
      name: 'rl host',
      status: 'active',
      createdAt: new Date(NOW * 1000),
      updatedAt: new Date(NOW * 1000),
    })
    await db.insert(agent).values({
      id: 'rl-agent',
      name: 'rl agent',
      mode: 'autonomous',
      status: 'active',
      publicKey: JSON.stringify(await exportJWK(keys.publicKey)),
      hostId: 'rl-host',
      createdAt: new Date(NOW * 1000),
      updatedAt: new Date(NOW * 1000),
    })

    const jwt = await new SignJWT({ aud: 'http://rl.test/api/auth' })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'agent+jwt' })
      .setIssuer('rl-host')
      .setSubject('rl-agent')
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .setExpirationTime('2m')
      .sign(keys.privateKey)

    const ip = '198.51.100.21'
    // Exhaust the IP bucket first.
    for (let i = 0; i < ANONYMOUS_LIMIT.limit; i++) {
      await enforceRateLimit(
        auth,
        db,
        env.SCHEMA_CACHE,
        anonRequest(ip),
        NOW + i,
      )
    }
    // The signed JWT rides its own authenticated bucket → still allowed.
    const request = new Request('http://rl.test/v1/models', {
      headers: { 'cf-connecting-ip': ip, authorization: `Bearer ${jwt}` },
    })
    expect(
      await enforceRateLimit(auth, db, env.SCHEMA_CACHE, request),
    ).toBeNull()
  })
})

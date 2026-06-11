import { beforeAll, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'

import { getDb } from '../db/index.ts'
import type { Db } from '../db/index.ts'
import { providers } from '../db/schema.ts'
import type { ApiKeyPrincipal } from './require-agent.ts'
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  parseCreateSubscriptionBody,
} from './subscriptions-api.ts'

const NOW = 1_781_150_000
let db: Db

const principal = (userId: string): ApiKeyPrincipal => ({
  kind: 'api-key',
  keyId: `key-${userId}`,
  name: 'Sub Tester',
  userId,
  capabilities: ['manage_subscriptions'],
})

beforeAll(async () => {
  db = getDb(env)
  await db.insert(providers).values({
    id: 'sub-prov',
    displayName: 'Sub Prov',
    specSourceUrl: 'https://example.com/spec.json',
  })
})

describe('parseCreateSubscriptionBody', () => {
  it('accepts valid bodies and rejects malformed ones', () => {
    expect(
      parseCreateSubscriptionBody({
        url: 'https://agent.example.com/hook',
        events: ['model.added', 'schema.updated'],
      }),
    ).not.toBeNull()
    expect(
      parseCreateSubscriptionBody({ url: 'ftp://x', events: ['model.added'] }),
    ).toBeNull()
    expect(
      parseCreateSubscriptionBody({ url: 'https://x.com', events: [] }),
    ).toBeNull()
    expect(
      parseCreateSubscriptionBody({ url: 'https://x.com', events: ['nope'] }),
    ).toBeNull()
    expect(parseCreateSubscriptionBody({ events: ['model.added'] })).toBeNull()
  })
})

describe('subscriptions CRUD round-trip', () => {
  it('creates (secret once), lists (no secret), deletes', async () => {
    const me = principal('sub-owner-1')

    const created = await createSubscription(
      db,
      me,
      {
        url: 'https://agent.example.com/hook',
        events: ['model.added'],
        provider: 'sub-prov',
      },
      NOW,
    )
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.result.secret).toMatch(/^whsec_[0-9a-f]{64}$/)
    expect(created.result.provider).toBe('sub-prov')

    const listed = await listSubscriptions(db, me)
    expect(listed.count).toBe(1)
    expect(listed.subscriptions[0]?.id).toBe(created.result.id)
    expect(listed.subscriptions[0]?.events).toEqual(['model.added'])
    // The secret is never echoed after creation.
    expect(JSON.stringify(listed)).not.toContain('whsec_')

    const deleted = await deleteSubscription(db, me, created.result.id)
    expect(deleted).toMatchObject({ ok: true })
    expect((await listSubscriptions(db, me)).count).toBe(0)
  })

  it('rejects unknown providers and enforces ownership', async () => {
    const me = principal('sub-owner-2')
    const them = principal('sub-owner-3')

    const badProvider = await createSubscription(db, me, {
      url: 'https://agent.example.com/hook',
      events: ['model.added'],
      provider: 'nope',
    })
    expect(badProvider).toMatchObject({ ok: false, status: 404 })

    const created = await createSubscription(db, me, {
      url: 'https://agent.example.com/hook',
      events: ['schema.updated'],
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    // Another principal can neither see nor delete it.
    expect((await listSubscriptions(db, them)).count).toBe(0)
    const stolen = await deleteSubscription(db, them, created.result.id)
    expect(stolen).toMatchObject({ ok: false, status: 404 })
    expect((await listSubscriptions(db, me)).count).toBe(1)
  })

  it('caps subscriptions per owner', async () => {
    const me = principal('sub-owner-cap')
    for (let i = 0; i < 10; i++) {
      const created = await createSubscription(db, me, {
        url: `https://agent.example.com/hook/${String(i)}`,
        events: ['model.added'],
      })
      expect(created.ok).toBe(true)
    }
    const eleventh = await createSubscription(db, me, {
      url: 'https://agent.example.com/hook/11',
      events: ['model.added'],
    })
    expect(eleventh).toMatchObject({
      ok: false,
      status: 409,
      code: 'subscription_limit',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'

import { getDb } from './index.ts'
import {
  cacheMeta,
  changes,
  providers,
  subscriptions,
  user,
  webhookDeliveries,
} from './schema.ts'

const NOW = 1_781_150_000

describe('cache + delivery tables (migrated D1)', () => {
  it('round-trips cache_meta', async () => {
    const db = getDb(env)
    await db.insert(cacheMeta).values({
      key: 'schemas:anthropic:chat',
      fetchedAt: NOW,
      staleTime: 600,
    })
    const row = await db.query.cacheMeta.findFirst({
      where: eq(cacheMeta.key, 'schemas:anthropic:chat'),
    })
    expect(row?.refreshing).toBe(false)
    expect(row?.staleTime).toBe(600)
  })

  it('links subscriptions to users and deliveries to subscriptions + changes', async () => {
    const db = getDb(env)

    await db.insert(user).values({
      id: 'user-1',
      name: 'Agent Owner',
      email: 'owner@example.com',
      createdAt: new Date(NOW * 1000),
      updatedAt: new Date(NOW * 1000),
    })
    await db.insert(providers).values({
      id: 'openrouter',
      displayName: 'OpenRouter',
      specSourceUrl: 'https://example.com/openapi.json',
    })
    await db.insert(changes).values({
      id: 'change-sub-1',
      type: 'model.added',
      providerId: 'openrouter',
      subjectId: 'openrouter-some-model',
      summary: 'Model added',
      createdAt: NOW,
    })
    await db.insert(subscriptions).values({
      id: 'sub-1',
      agentId: 'user-1',
      url: 'https://agent.example.com/hooks',
      secret: 'shh',
      events: ['model.added', 'schema.updated'],
      providerFilter: 'openrouter',
      createdAt: NOW,
    })
    await db.insert(webhookDeliveries).values({
      id: 'delivery-1',
      subscriptionId: 'sub-1',
      changeId: 'change-sub-1',
      nextAttemptAt: NOW,
    })

    const delivery = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, 'delivery-1'),
      with: { subscription: { with: { agent: true } }, change: true },
    })
    expect(delivery?.status).toBe('pending')
    expect(delivery?.attempt).toBe(0)
    expect(delivery?.subscription.agent.email).toBe('owner@example.com')
    expect(delivery?.subscription.events).toEqual([
      'model.added',
      'schema.updated',
    ])
    expect(delivery?.change.type).toBe('model.added')
  })

  it('enforces the subscription foreign key on deliveries', async () => {
    const db = getDb(env)
    await expect(
      db.insert(webhookDeliveries).values({
        id: 'delivery-orphan',
        subscriptionId: 'no-such-sub',
        changeId: 'no-such-change',
        nextAttemptAt: NOW,
      }),
    ).rejects.toThrow()
  })
})

import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'

import { getDb } from './index.ts'
import {
  changes,
  endpoints,
  models,
  providers,
  schemaVersions,
} from './schema.ts'

const NOW = 1_781_150_000

describe('core domain tables (migrated D1)', () => {
  it('inserts and queries a provider with related rows across all five tables', async () => {
    const db = getDb(env)

    await db.insert(providers).values({
      id: 'anthropic',
      displayName: 'Anthropic',
      specSourceUrl: 'https://example.com/spec.yml',
      modelsEndpoint: 'https://api.anthropic.com/v1/models',
      authEnvVar: 'ANTHROPIC_API_KEY',
    })

    await db.insert(models).values({
      id: 'anthropic-claude-fable-5',
      providerId: 'anthropic',
      rawId: 'claude-fable-5',
      activity: 'chat',
      displayName: 'Claude Fable 5',
      contextWindow: 200_000,
      modalities: { input: ['text', 'image'], output: ['text'] },
      firstSeenAt: NOW,
      lastSeenAt: NOW,
    })

    await db.insert(endpoints).values({
      id: 'anthropic-messages',
      providerId: 'anthropic',
      activity: 'chat',
      method: 'POST',
      path: '/v1/messages',
    })

    await db.insert(schemaVersions).values({
      id: 'anthropic-messages-input-1',
      endpointId: 'anthropic-messages',
      kind: 'input',
      contentHash: 'a'.repeat(64),
      schema: JSON.stringify({ type: 'object' }),
      createdAt: NOW,
    })

    await db.insert(changes).values({
      id: 'change-1',
      type: 'model.added',
      providerId: 'anthropic',
      subjectId: 'anthropic-claude-fable-5',
      summary: 'Model claude-fable-5 added',
      createdAt: NOW,
    })

    const model = await db.query.models.findFirst({
      where: eq(models.id, 'anthropic-claude-fable-5'),
      with: { provider: true },
    })
    expect(model?.activity).toBe('chat')
    expect(model?.provider.displayName).toBe('Anthropic')
    expect(model?.modalities).toEqual({
      input: ['text', 'image'],
      output: ['text'],
    })

    const version = await db.query.schemaVersions.findFirst({
      where: eq(schemaVersions.contentHash, 'a'.repeat(64)),
      with: { endpoint: true },
    })
    expect(version?.kind).toBe('input')
    expect(version?.endpoint.path).toBe('/v1/messages')

    const changeRows = await db
      .select()
      .from(changes)
      .where(eq(changes.providerId, 'anthropic'))
    expect(changeRows).toHaveLength(1)
    expect(changeRows[0]?.type).toBe('model.added')
  })

  it('enforces the providers foreign key', async () => {
    const db = getDb(env)
    await expect(
      db.insert(models).values({
        id: 'orphan-model',
        providerId: 'no-such-provider',
        rawId: 'orphan',
        firstSeenAt: NOW,
        lastSeenAt: NOW,
      }),
    ).rejects.toThrow()
  })
})

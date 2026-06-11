import { beforeAll, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'

import { getDb } from '../db/index.ts'
import type { Db } from '../db/index.ts'
import { endpoints, providers, schemaVersions } from '../db/schema.ts'
import {
  getActivitySchemaMap,
  getEndpointSchema,
  getProviderSchemaIndex,
  knownEndpointIds,
  publicEndpointId,
} from './schemas-api.ts'

const NOW = 1_781_150_000
const INPUT_SCHEMA = {
  type: 'object',
  properties: { model: { type: 'string' }, blocks: { type: 'array' } },
  $defs: { Block: { type: 'object' } },
}
const OLD_INPUT = { type: 'object', properties: { model: { type: 'string' } } }
const OUTPUT_SCHEMA = { type: 'object', properties: { id: { type: 'string' } } }

let db: Db

beforeAll(async () => {
  db = getDb(env)
  await db.insert(providers).values({
    id: 'sch-prov',
    displayName: 'Schema Prov',
    specSourceUrl: 'https://example.com/spec.json',
  })
  await db.insert(endpoints).values([
    {
      id: 'sch-prov/v1/messages',
      providerId: 'sch-prov',
      activity: 'chat',
      method: 'POST',
      path: '/v1/messages',
    },
    {
      id: 'sch-prov/v1/images/generations',
      providerId: 'sch-prov',
      activity: 'image',
      method: 'POST',
      path: '/v1/images/generations',
    },
  ])
  await db.insert(schemaVersions).values([
    {
      id: 'sch-prov/v1/messages:input:current',
      endpointId: 'sch-prov/v1/messages',
      kind: 'input',
      contentHash: 'f'.repeat(64),
      schema: JSON.stringify(INPUT_SCHEMA),
      createdAt: NOW,
    },
    {
      id: 'sch-prov/v1/messages:input:old',
      endpointId: 'sch-prov/v1/messages',
      kind: 'input',
      contentHash: 'e'.repeat(64),
      schema: JSON.stringify(OLD_INPUT),
      createdAt: NOW - 100,
      supersededAt: NOW,
    },
    {
      id: 'sch-prov/v1/messages:output:current',
      endpointId: 'sch-prov/v1/messages',
      kind: 'output',
      contentHash: 'a'.repeat(64),
      schema: JSON.stringify(OUTPUT_SCHEMA),
      createdAt: NOW,
    },
  ])
})

describe('getProviderSchemaIndex', () => {
  it('groups public endpoint ids by activity', async () => {
    const index = await getProviderSchemaIndex(db, 'sch-prov')
    expect(index.activities).toEqual({
      chat: ['v1/messages'],
      image: ['v1/images/generations'],
    })
    expect(index.count).toBe(2)
  })
})

describe('getActivitySchemaMap', () => {
  it('returns the endpoint-id-keyed map of current versions only', async () => {
    const map = await getActivitySchemaMap(db, 'sch-prov', 'chat')
    expect(Object.keys(map.endpoints)).toEqual(['v1/messages'])
    expect(map.endpoints['v1/messages']?.input).toEqual(INPUT_SCHEMA)
    expect(map.endpoints['v1/messages']?.output).toEqual(OUTPUT_SCHEMA)
    // The superseded version is not served.
    expect(map.endpoints['v1/messages']?.input).not.toEqual(OLD_INPUT)
  })

  it('is empty for activities without endpoints', async () => {
    const map = await getActivitySchemaMap(db, 'sch-prov', 'audio')
    expect(map.count).toBe(0)
  })
})

describe('getEndpointSchema', () => {
  it('serves the current input schema byte-identical to D1', async () => {
    const result = await getEndpointSchema(
      db,
      'sch-prov',
      'chat',
      'v1/messages',
    )
    expect(result?.kind).toBe('input')
    expect(result?.contentHash).toBe('f'.repeat(64))
    const stored = await db.query.schemaVersions.findFirst({
      where: eq(schemaVersions.id, 'sch-prov/v1/messages:input:current'),
    })
    expect(JSON.stringify(result?.schema)).toBe(stored?.schema)
  })

  it('serves output schemas and historical versions by content hash', async () => {
    const output = await getEndpointSchema(
      db,
      'sch-prov',
      'chat',
      'v1/messages',
      'output',
    )
    expect(output?.schema).toEqual(OUTPUT_SCHEMA)

    const historical = await getEndpointSchema(
      db,
      'sch-prov',
      'chat',
      'v1/messages',
      'input',
      'e'.repeat(64),
    )
    expect(historical?.schema).toEqual(OLD_INPUT)
    expect(historical?.supersededAt).toBe(NOW)
  })

  it('returns null for unknown endpoint, wrong activity, or bad version', async () => {
    expect(await getEndpointSchema(db, 'sch-prov', 'chat', 'nope')).toBeNull()
    expect(
      await getEndpointSchema(db, 'sch-prov', 'image', 'v1/messages'),
    ).toBeNull()
    expect(
      await getEndpointSchema(
        db,
        'sch-prov',
        'chat',
        'v1/messages',
        'input',
        'deadbeef',
      ),
    ).toBeNull()
  })
})

describe('helpers', () => {
  it('derives public endpoint ids and 404 hints', async () => {
    expect(publicEndpointId('sch-prov/v1/messages', 'sch-prov')).toBe(
      'v1/messages',
    )
    expect(await knownEndpointIds(db, 'sch-prov', 'chat')).toEqual([
      'v1/messages',
    ])
    expect(await knownEndpointIds(db, 'sch-prov')).toEqual([
      'v1/images/generations',
      'v1/messages',
    ])
  })
})

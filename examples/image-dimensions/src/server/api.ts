/**
 * Server-side catalog: the modelschemas API is only ever called from the
 * server (TanStack Start server functions), so the browser needs no CORS.
 */
import { createServerFn } from '@tanstack/react-start'
import {
  createModelschemasClient,
  getActivitySchemas,
  listProviders,
} from '@modelschemas/client'
import { extractDimensions } from '../lib/dimensions'
import type { DimensionReport, SchemaNode } from '../lib/dimensions'

const BASE_URL = process.env.MODELSCHEMAS_URL ?? 'https://modelschemas.com'

export interface ImageModelEntry {
  provider: string
  endpointId: string
  report: DimensionReport
}

export interface ImageCatalog {
  baseUrl: string
  /** Providers swept, in catalog order. */
  providers: Array<string>
  entries: Array<ImageModelEntry>
}

function isNode(value: unknown): value is SchemaNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function buildCatalog(): Promise<ImageCatalog> {
  const client = createModelschemasClient({ baseUrl: BASE_URL })

  const providersResult = await listProviders({ client })
  const providerList = isNode(providersResult.data)
    ? providersResult.data['providers']
    : undefined
  const providerIds = Array.isArray(providerList)
    ? providerList
        .map((entry) => (isNode(entry) ? entry['id'] : undefined))
        .filter((id): id is string => typeof id === 'string')
    : []

  const entries: Array<ImageModelEntry> = []
  await Promise.all(
    providerIds.map(async (provider) => {
      // 404 = provider has no image schemas synced; skip quietly.
      const result = await getActivitySchemas({
        client,
        path: { provider, activity: 'image' },
      })
      if (result.error !== undefined || !isNode(result.data)) return
      const endpoints = result.data['endpoints']
      if (!isNode(endpoints)) return
      for (const [endpointId, pair] of Object.entries(endpoints)) {
        if (!isNode(pair)) continue
        const input = pair['input']
        if (!isNode(input)) continue
        entries.push({
          provider,
          endpointId,
          report: extractDimensions(input),
        })
      }
    }),
  )

  entries.sort((a, b) =>
    a.provider === b.provider
      ? a.endpointId.localeCompare(b.endpointId)
      : a.provider.localeCompare(b.provider),
  )
  return { baseUrl: BASE_URL, providers: providerIds, entries }
}

let cache: { at: number; catalog: Promise<ImageCatalog> } | null = null
const TTL_MS = 5 * 60 * 1000

export const getImageCatalog = createServerFn({ method: 'GET' }).handler(
  (): Promise<ImageCatalog> => {
    if (cache === null || Date.now() - cache.at > TTL_MS) {
      cache = { at: Date.now(), catalog: buildCatalog() }
      cache.catalog.catch(() => {
        cache = null
      })
    }
    return cache.catalog
  },
)

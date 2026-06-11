import { createFileRoute } from '@tanstack/react-router'
import { env, waitUntil } from 'cloudflare:workers'

import { getDb } from '#/db/index.ts'
import { jsonError } from '#/server/admin.ts'
import { swr } from '#/server/cache.ts'
import { knownProviderIds } from '#/server/catalog.ts'
import { cachedJson } from '#/server/http-cache.ts'
import { getProviderSchemaIndex, providerExists } from '#/server/schemas-api.ts'

export const Route = createFileRoute('/v1/schemas/$provider/')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const db = getDb(env)
        if (!(await providerExists(db, params.provider))) {
          const valid = (await knownProviderIds(db)).join(', ')
          return jsonError(
            404,
            'unknown_provider',
            `Unknown provider '${params.provider}'. Valid providers: ${valid}.`,
          )
        }
        const result = await swr(
          { db, kv: env.SCHEMA_CACHE, waitUntil },
          `schema-index:${params.provider}`,
          () => getProviderSchemaIndex(db, params.provider),
          { staleTime: 300 },
        )
        return cachedJson(request, result.value, {
          fetchedAt: result.fetchedAt,
          staleAt: result.staleAt,
        })
      },
    },
  },
})

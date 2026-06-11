import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { getDb } from '#/db/index.ts'
import { halGet } from '#/server/hal.ts'
import { getServiceStatus } from '#/server/status.ts'

export const Route = createFileRoute('/v1/status')({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ...(await getServiceStatus(getDb(env))),
          _links: {
            self: halGet('/v1/status'),
            index: halGet('/v1'),
            providers: halGet('/v1/providers'),
          },
        }),
    },
  },
})

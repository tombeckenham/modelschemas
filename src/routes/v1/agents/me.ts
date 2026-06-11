import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { agentsMe } from '#/server/agents-api.ts'
import { getAuth } from '#/server/auth.ts'

export const Route = createFileRoute('/v1/agents/me')({
  server: {
    handlers: {
      GET: ({ request }) => agentsMe(getAuth(), env.SCHEMA_CACHE, request),
    },
  },
})

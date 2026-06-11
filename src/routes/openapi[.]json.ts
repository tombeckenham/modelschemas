import { createFileRoute } from '@tanstack/react-router'

import { openApiDocument } from '#/server/openapi.ts'

export const Route = createFileRoute('/openapi.json')({
  server: {
    handlers: {
      GET: () => Response.json(openApiDocument),
    },
  },
})

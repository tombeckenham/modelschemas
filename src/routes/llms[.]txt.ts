import { createFileRoute } from '@tanstack/react-router'

import { llmsTxt } from '#/server/llms-txt.ts'

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(llmsTxt, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})

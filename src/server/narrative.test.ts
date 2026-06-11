import { describe, expect, it } from 'vitest'

import { serviceIndex } from '../routes/v1/index.ts'
import { llmsTxt } from './llms-txt.ts'
import {
  NARRATIVE_INSTRUCTIONS,
  narrativeRoot,
  wantsJsonRoot,
} from './narrative.ts'

const ORIGIN = 'https://modelschemas.com'

describe('narrative API root (task 11.2)', () => {
  it('shares one source with llms.txt / MCP initialize instructions', () => {
    expect(NARRATIVE_INSTRUCTIONS).toBe(llmsTxt)
    const root = narrativeRoot(ORIGIN)
    expect(root.instructions).toBe(llmsTxt)
  })

  it('carries HAL links and inline examples', () => {
    const root = narrativeRoot(ORIGIN) as {
      _links: typeof serviceIndex._links
      quickstart: Array<string>
      mcp: { endpoint: string }
    }
    expect(root._links).toBe(serviceIndex._links)
    expect(root._links.self.href).toBe('/v1')
    expect(root.quickstart.some((q) => q.includes('/v1/validate'))).toBe(true)
    expect(root.mcp.endpoint).toBe(`${ORIGIN}/mcp`)
  })

  it('negotiates only explicit JSON GETs', () => {
    const request = (accept: string, method = 'GET') =>
      new Request('https://x.test/', { method, headers: { accept } })
    expect(wantsJsonRoot(request('application/json'))).toBe(true)
    // Browsers lead with text/html — they keep the landing page.
    expect(wantsJsonRoot(request('text/html,application/json;q=0.8'))).toBe(
      false,
    )
    expect(wantsJsonRoot(request('*/*'))).toBe(false)
    expect(wantsJsonRoot(request('application/json', 'POST'))).toBe(false)
  })
})

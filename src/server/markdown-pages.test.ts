import { describe, expect, it } from 'vitest'

import { llmsTxt } from './llms-txt.ts'
import {
  markdownForPath,
  markdownResponse,
  wantsMarkdown,
} from './markdown-pages.ts'

const ORIGIN = 'https://modelschemas.com'

describe('markdown negotiation (task 10.5)', () => {
  it('detects Accept: text/markdown on GET only', () => {
    const get = (accept?: string) =>
      new Request('https://x.test/', {
        headers: accept ? { accept } : {},
      })
    expect(wantsMarkdown(get('text/markdown'))).toBe(true)
    expect(wantsMarkdown(get('text/html, text/markdown;q=0.9'))).toBe(true)
    expect(wantsMarkdown(get('text/html'))).toBe(false)
    expect(wantsMarkdown(get())).toBe(false)
    expect(
      wantsMarkdown(
        new Request('https://x.test/', {
          method: 'POST',
          headers: { accept: 'text/markdown' },
        }),
      ),
    ).toBe(false)
  })

  it('serves the llms.txt source for /docs and a summary for /', () => {
    expect(markdownForPath('/docs', ORIGIN)).toBe(llmsTxt)
    const landing = markdownForPath('/', ORIGIN)
    expect(landing).toContain('# modelschemas')
    expect(landing).toContain(`${ORIGIN}/v1/models`)
    expect(landing).toContain(`${ORIGIN}/mcp`)
    expect(landing).toContain(`${ORIGIN}/llms.txt`)
    expect(markdownForPath('/login', ORIGIN)).toBeNull()
  })

  it('markdown responses are 200 text/markdown with Vary: Accept', () => {
    const response = markdownResponse('# hi')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8',
    )
    expect(response.headers.get('vary')).toBe('Accept')
  })
})

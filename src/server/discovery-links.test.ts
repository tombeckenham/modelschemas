import { describe, expect, it } from 'vitest'

import { DISCOVERY_LINK_HEADER, withDiscoveryLinks } from './discovery-links.ts'

describe('discovery Link headers (task 10.2)', () => {
  it('appends the Link header to HTML responses', () => {
    const wrapped = withDiscoveryLinks(
      new Response('<html></html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    )
    const link = wrapped.headers.get('link') ?? ''
    expect(link).toBe(DISCOVERY_LINK_HEADER)
    expect(link).toContain('</.well-known/api-catalog>; rel="api-catalog"')
    expect(link).toContain('rel="service-desc"')
    expect(link).toContain('rel="service-doc"')
  })

  it('leaves JSON responses untouched', () => {
    const original = Response.json({ ok: true })
    const wrapped = withDiscoveryLinks(original)
    expect(wrapped).toBe(original)
    expect(wrapped.headers.get('link')).toBeNull()
  })
})

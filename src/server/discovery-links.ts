/**
 * RFC 8288 Link headers for agent discovery (PLAN.md task 10.2), appended to
 * HTML responses by the worker fetch wrapper. JSON/API responses are left
 * untouched.
 */

export const DISCOVERY_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</openapi.json>; rel="service-desc"; type="application/json"',
  '</docs>; rel="service-doc"',
  '</llms.txt>; rel="describedby"; type="text/markdown"',
  '</.well-known/agent-configuration>; rel="agent-configuration"',
].join(', ')

/** Append the discovery Link header to HTML responses (new Response — the
 * SSR response's headers are immutable). */
export function withDiscoveryLinks(response: Response): Response {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return response
  const wrapped = new Response(response.body, response)
  wrapped.headers.append('Link', DISCOVERY_LINK_HEADER)
  return wrapped
}

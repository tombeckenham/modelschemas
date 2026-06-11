/**
 * HAL link objects (PLAN.md task 11.1). Standard HAL gives agents `href`
 * (RFC 6570 templates where applicable); we extend each link with `method`,
 * `contentType`, and an inline `example` because agents — unlike humans
 * reading docs — need those to act without a second lookup. Documented in
 * llms.txt.
 */

export interface HalLink {
  href: string
  method: 'GET' | 'POST' | 'DELETE'
  contentType: string
  templated?: true
  /** A concrete, copy-pasteable instantiation of href (URL for GETs, a
   * request body for POSTs). */
  example?: string | Record<string, unknown>
}

interface LinkOptions {
  example?: string | Record<string, unknown>
  contentType?: string
}

function isTemplated(href: string): boolean {
  return href.includes('{')
}

export function halGet(href: string, options: LinkOptions = {}): HalLink {
  return {
    href,
    method: 'GET',
    contentType: options.contentType ?? 'application/json',
    ...(isTemplated(href) ? { templated: true as const } : {}),
    ...(options.example !== undefined ? { example: options.example } : {}),
  }
}

export function halPost(href: string, options: LinkOptions = {}): HalLink {
  return {
    href,
    method: 'POST',
    contentType: options.contentType ?? 'application/json',
    ...(isTemplated(href) ? { templated: true as const } : {}),
    ...(options.example !== undefined ? { example: options.example } : {}),
  }
}

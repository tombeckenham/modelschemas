import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'

import { getDb } from '../db/index.ts'
import { cacheMeta } from '../db/schema.ts'
import { swr } from './cache.ts'
import type { SwrDeps } from './cache.ts'

function makeDeps(start: number) {
  const pending: Array<Promise<unknown>> = []
  let current = start
  const deps: SwrDeps = {
    db: getDb(env),
    kv: env.SCHEMA_CACHE,
    waitUntil: (p) => pending.push(p),
    now: () => current,
  }
  return {
    deps,
    flush: () => Promise.all(pending.splice(0)),
    advance: (seconds: number) => {
      current += seconds
    },
    pendingCount: () => pending.length,
  }
}

function countingFetcher<T>(values: Array<T>) {
  let calls = 0
  return {
    fetcher: () => {
      const value = values[Math.min(calls, values.length - 1)]
      calls++
      if (value instanceof Error) return Promise.reject(value)
      return Promise.resolve(value as Exclude<T, Error>)
    },
    calls: () => calls,
  }
}

describe('swr', () => {
  it('miss: fetches inline and persists value + metadata', async () => {
    const { deps } = makeDeps(1000)
    const { fetcher, calls } = countingFetcher([{ v: 1 }])

    const result = await swr(deps, 'miss-key', fetcher, { staleTime: 60 })
    expect(result).toEqual({
      value: { v: 1 },
      fetchedAt: 1000,
      staleAt: 1060,
      revalidating: false,
    })
    expect(calls()).toBe(1)

    const meta = await deps.db.query.cacheMeta.findFirst({
      where: eq(cacheMeta.key, 'miss-key'),
    })
    expect(meta).toMatchObject({
      fetchedAt: 1000,
      staleTime: 60,
      refreshing: false,
    })
  })

  it('fresh hit: serves from cache without calling the fetcher', async () => {
    const { deps, advance } = makeDeps(1000)
    const seed = countingFetcher([{ v: 'seed' }])
    await swr(deps, 'fresh-key', seed.fetcher, { staleTime: 60 })

    advance(30) // still fresh
    const { fetcher, calls } = countingFetcher([{ v: 'never' }])
    const result = await swr(deps, 'fresh-key', fetcher, { staleTime: 60 })
    expect(result.value).toEqual({ v: 'seed' })
    expect(result.revalidating).toBe(false)
    expect(calls()).toBe(0)
  })

  it('stale hit: serves the old value and revalidates in the background', async () => {
    const { deps, advance, flush } = makeDeps(1000)
    const seed = countingFetcher([{ v: 'old' }])
    await swr(deps, 'stale-key', seed.fetcher, { staleTime: 60 })

    advance(61) // past staleAt, before the 2× stuck window
    const { fetcher, calls } = countingFetcher([{ v: 'new' }])
    const result = await swr(deps, 'stale-key', fetcher, { staleTime: 60 })
    expect(result.value).toEqual({ v: 'old' }) // stale value served immediately
    expect(result.revalidating).toBe(true)

    await flush()
    expect(calls()).toBe(1)

    // Next read sees the revalidated value, fresh again.
    const after = await swr(deps, 'stale-key', fetcher, { staleTime: 60 })
    expect(after.value).toEqual({ v: 'new' })
    expect(after.fetchedAt).toBe(1061)
    expect(after.revalidating).toBe(false)
  })

  it('dedupes concurrent revalidation via the refreshing flag', async () => {
    const { deps, advance, pendingCount } = makeDeps(1000)
    const seed = countingFetcher([{ v: 'old' }])
    await swr(deps, 'dedupe-key', seed.fetcher, { staleTime: 60 })

    advance(61)
    const first = countingFetcher([{ v: 'first' }])
    const r1 = await swr(deps, 'dedupe-key', first.fetcher, { staleTime: 60 })
    expect(r1.revalidating).toBe(true)

    // Second stale read while the flag is set: no second revalidation.
    const second = countingFetcher([{ v: 'second' }])
    const r2 = await swr(deps, 'dedupe-key', second.fetcher, { staleTime: 60 })
    expect(r2.revalidating).toBe(false)
    expect(second.calls()).toBe(0)
    expect(pendingCount()).toBe(1)
  })

  it('ignores a stuck refreshing flag older than 2× staleTime', async () => {
    const { deps, advance, flush } = makeDeps(1000)
    const seed = countingFetcher([{ v: 'old' }])
    await swr(deps, 'stuck-key', seed.fetcher, { staleTime: 60 })

    // Simulate a crashed revalidation that left the flag set.
    await deps.db
      .update(cacheMeta)
      .set({ refreshing: true })
      .where(eq(cacheMeta.key, 'stuck-key'))

    advance(121) // > fetchedAt + 2×staleTime
    const { fetcher, calls } = countingFetcher([{ v: 'recovered' }])
    const result = await swr(deps, 'stuck-key', fetcher, { staleTime: 60 })
    expect(result.revalidating).toBe(true)
    await flush()
    expect(calls()).toBe(1)

    const after = await swr(deps, 'stuck-key', fetcher, { staleTime: 60 })
    expect(after.value).toEqual({ v: 'recovered' })
  })

  it('records lastError and clears the flag when background revalidation fails', async () => {
    const { deps, advance, flush } = makeDeps(1000)
    const seed = countingFetcher([{ v: 'old' }])
    await swr(deps, 'error-key', seed.fetcher, { staleTime: 60 })

    advance(61)
    const failing = countingFetcher([new Error('upstream exploded')])
    const result = await swr(deps, 'error-key', failing.fetcher, {
      staleTime: 60,
    })
    expect(result.value).toEqual({ v: 'old' })
    await flush()

    const meta = await deps.db.query.cacheMeta.findFirst({
      where: eq(cacheMeta.key, 'error-key'),
    })
    expect(meta?.refreshing).toBe(false)
    expect(meta?.lastError).toBe('upstream exploded')
    // The stale value is still served on the next read.
    const after = await swr(deps, 'error-key', seed.fetcher, { staleTime: 60 })
    expect(after.value).toEqual({ v: 'old' })
  })
})

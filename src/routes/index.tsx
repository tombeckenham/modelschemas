import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { registerWebMcp } from '#/lib/webmcp.ts'

import {
  CHANGE_STYLES,
  Figure,
  STATUS_DOT,
  SiteFooter,
  SiteNav,
} from '#/components/site.tsx'
import type { ServiceStatus } from '#/server/status.ts'

interface DashboardChange {
  id: string
  type: string
  providerId: string
  summary: string
  createdAt: number
}

interface DashboardData {
  status: ServiceStatus
  changes: Array<DashboardChange>
}

const getDashboardData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardData> => {
    const { env } = await import('cloudflare:workers')
    const { getDb } = await import('#/db/index.ts')
    const { getServiceStatus } = await import('#/server/status.ts')
    const { listChanges } = await import('#/server/changes-api.ts')

    const db = getDb(env)
    const [status, changesOutcome] = await Promise.all([
      getServiceStatus(db),
      listChanges(db, { limit: 12 }),
    ])
    return {
      status,
      changes: changesOutcome.ok
        ? changesOutcome.result.changes.map((c) => ({
            id: c.id,
            type: c.type,
            providerId: c.providerId,
            summary: c.summary,
            createdAt: c.createdAt,
          }))
        : [],
    }
  },
)

export const Route = createFileRoute('/')({
  loader: () => getDashboardData(),
  component: Landing,
})

export function timeAgo(epochSeconds: number | null): string {
  if (!epochSeconds) return 'never'
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - epochSeconds)
  if (delta < 90) return `${String(delta)}s ago`
  if (delta < 5400) return `${String(Math.round(delta / 60))}m ago`
  if (delta < 129_600) return `${String(Math.round(delta / 3600))}h ago`
  return `${String(Math.round(delta / 86_400))}d ago`
}

function SectionRule({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="rule-heavy flex items-baseline justify-between gap-4 pb-2">
      <h2 className="overline-label !text-ink">
        <span aria-hidden className="mr-2 text-press">
          §
        </span>
        {title}
      </h2>
      {aside ? (
        <span className="hidden font-mono text-xs text-ink-faint sm:block">
          {aside}
        </span>
      ) : null}
    </div>
  )
}

function Landing() {
  const { status, changes } = Route.useLoaderData()
  // WebMCP (task 10.6): in-page tools for browsers that ship
  // navigator.modelContext; silently absent everywhere else.
  useEffect(() => {
    registerWebMcp()
  }, [])
  const totals = status.providers.reduce(
    (acc, p) => ({
      models: acc.models + p.counts.models,
      endpoints: acc.endpoints + p.counts.endpoints,
      schemas: acc.schemas + p.counts.schemas,
    }),
    { models: 0, endpoints: 0, schemas: 0 },
  )

  return (
    <div className="min-h-screen text-ink">
      <SiteNav />

      {/* front page */}
      <header className="mx-auto max-w-6xl px-5 pt-14 pb-10 lg:pt-20">
        <p className="fade-up flex items-center gap-2 font-mono text-xs text-ink-soft">
          <span className="pulse-dot bg-live" />
          live · model lists every 15 minutes · full specs daily
        </p>
        <h1 className="fade-up fade-up-1 mt-5 max-w-4xl font-display text-[2.9rem] leading-[1.02] font-medium tracking-tight sm:text-6xl lg:text-7xl">
          Live AI model schemas<span className="text-press">.</span>
        </h1>
        <div className="fade-up fade-up-2 mt-7 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Which models exist right now, and what their payloads look like.
            Request/response JSON Schemas for {status.providers.length}{' '}
            providers, served as plain JSON.
          </p>
          <div className="flex flex-wrap items-start gap-3 font-mono text-sm">
            <a
              href="/v1/models"
              className="border border-ink bg-ink px-4 py-2 text-paper transition-colors hover:bg-press hover:border-press"
            >
              GET /v1/models
            </a>
            <a
              href="/docs"
              className="hairline border px-4 py-2 transition-colors hover:border-ink"
            >
              read the docs
            </a>
            <a href="/account" className="press-link px-1 py-2 text-ink-soft">
              get an API key →
            </a>
          </div>
        </div>
      </header>

      {/* by the numbers */}
      <section className="hairline border-y bg-paper-raised">
        <div className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-4">
          {(
            [
              ['models tracked', totals.models],
              ['endpoints', totals.endpoints],
              ['schema versions', totals.schemas],
              ['providers', status.providers.length],
            ] as const
          ).map(([label, n], i) => (
            <div
              key={label}
              className={`px-5 py-6 ${i > 0 ? 'hairline sm:border-l' : ''}`}
            >
              <div className="font-display text-4xl font-medium tabular-nums">
                {n}
              </div>
              <div className="overline-label mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* for agents */}
      <section className="mx-auto max-w-6xl space-y-6 px-5 py-14">
        <SectionRule
          title="For agents"
          aside="no signup for reads · 60 req/h anonymous · 5k with a key"
        />

        <div className="grid gap-5 md:grid-cols-2">
          <Figure title="catalog + schema, raw http">
            <pre className="whitespace-pre-wrap">
              <code>
                <span className="text-press">$</span>{' '}
                {
                  'curl https://modelschemas.com/v1/models?activity=chat&q=claude'
                }
                {'\n'}
                <span className="text-press">$</span>{' '}
                {
                  'curl https://modelschemas.com/v1/schemas/anthropic/chat/v1%2Fmessages'
                }
              </code>
            </pre>
          </Figure>

          <Figure title="validate before you spend tokens">
            <pre className="whitespace-pre-wrap">
              <code>
                <span className="text-press">$</span>{' '}
                {'curl -X POST https://modelschemas.com/v1/validate \\'}
                {'\n    '}
                {`-d '{"provider":"anthropic","endpointId":"v1/messages","payload":{…}}'`}
                {'\n'}
                <span className="text-ink-faint">
                  {`→ {"valid":false,"errors":[{"path":"#","keyword":"required",…}]}`}
                </span>
              </code>
            </pre>
          </Figure>

          <Figure title="mcp · streamable http">
            <pre className="whitespace-pre-wrap">
              <code>
                endpoint:{' '}
                <span className="text-press-deep">
                  https://modelschemas.com/mcp
                </span>
                {'\n'}
                tools: list_models · get_model · get_schema · validate_payload ·
                recent_changes
              </code>
            </pre>
          </Figure>

          <Figure title="discovery + skill install">
            <pre className="whitespace-pre-wrap">
              <code>
                <a className="press-link" href="/llms.txt">
                  /llms.txt
                </a>{' '}
                — agent guide{'\n'}
                <a
                  className="press-link"
                  href="/.well-known/agent-configuration"
                >
                  /.well-known/agent-configuration
                </a>{' '}
                — agent-auth{'\n'}
                <a className="press-link" href="/skill">
                  /skill
                </a>{' '}
                — drop into .claude/skills/
              </code>
            </pre>
          </Figure>
        </div>
      </section>

      {/* providers */}
      <section className="mx-auto max-w-6xl space-y-5 px-5 pb-14">
        <SectionRule title="Providers" />
        <div className="figure">
          <table className="w-full font-mono text-[13px]">
            <thead>
              <tr className="figure-caption text-left">
                <th className="px-4 py-2 font-semibold">provider</th>
                <th className="px-4 py-2 font-semibold">status</th>
                <th className="px-4 py-2 text-right font-semibold">models</th>
                <th className="px-4 py-2 text-right font-semibold">schemas</th>
                <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">
                  polled
                </th>
                <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">
                  synced
                </th>
              </tr>
            </thead>
            <tbody>
              {status.providers.map((p) => (
                <tr key={p.id} className="hairline border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    <a
                      className="press-link"
                      href={`/v1/providers/${p.id}/models`}
                    >
                      {p.displayName}
                    </a>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`pulse-dot ${STATUS_DOT[p.status] ?? 'bg-ink-faint'}`}
                      />
                      <span className="text-xs">{p.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.counts.models}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.counts.schemas}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right text-ink-faint sm:table-cell">
                    {timeAgo(p.lastPolledAt)}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right text-ink-faint sm:table-cell">
                    {timeAgo(p.lastSyncedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* change log */}
      <section className="mx-auto max-w-6xl space-y-5 px-5 pb-20">
        <SectionRule title="Just changed" aside="GET /v1/changes" />
        {changes.length === 0 ? (
          <p className="font-mono text-sm text-ink-faint">
            no changes yet — the next cron poll will populate this feed.
          </p>
        ) : (
          <div className="figure px-4 py-3">
            <ol className="space-y-1.5 font-mono text-[13px]">
              {changes.map((change) => (
                <li key={change.id} className="flex items-baseline gap-3">
                  <span className="shrink-0 text-ink-faint">
                    {timeAgo(change.createdAt)}
                  </span>
                  <span
                    className={`shrink-0 ${CHANGE_STYLES[change.type] ?? 'text-ink-soft'}`}
                  >
                    {change.type}
                  </span>
                  <span className="truncate">{change.summary}</span>
                  <span className="ml-auto hidden shrink-0 text-ink-faint sm:inline">
                    {change.providerId}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import {
  CHANGE_STYLES,
  STATUS_DOT,
  SiteFooter,
  SiteNav,
  Terminal,
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

const HERO_SCHEMA = `{
  "type": "object",
  "required": ["model", "max_tokens", "messages"],
  "properties": {
    "model":      { "type": "string" },
    "max_tokens": { "type": "integer", "minimum": 1 },
    "messages":   { "$ref": "#/$defs/InputMessage" }
  },
  "$defs": { … }
}`

function Landing() {
  const { status, changes } = Route.useLoaderData()
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

      {/* hero */}
      <header className="mx-auto grid max-w-6xl gap-10 px-5 pt-16 pb-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-24">
        <div className="space-y-6">
          <p className="fade-up font-mono text-xs tracking-[0.3em] text-phosphor uppercase">
            ● live · refreshed every 15 minutes
          </p>
          <h1 className="fade-up fade-up-1 font-display text-5xl leading-[1.02] text-ink-bright sm:text-6xl lg:text-7xl">
            Live AI model schemas,
            <br />
            <em className="text-phosphor">as they exist right now.</em>
          </h1>
          <p className="fade-up fade-up-2 max-w-xl text-base leading-relaxed">
            Which models can you call this minute — and what exactly do their
            request and response payloads look like? modelschemas watches{' '}
            {status.providers.length} providers, content-hashes every endpoint
            schema, and serves the lot as plain JSON. Built for agents; humans
            tolerated.
          </p>
          <div className="fade-up fade-up-3 flex flex-wrap gap-3 font-mono text-sm">
            <a
              href="/v1/models"
              className="rounded border border-phosphor/60 bg-phosphor/10 px-4 py-2 text-phosphor transition hover:bg-phosphor/20"
            >
              GET /v1/models
            </a>
            <a
              href="/docs"
              className="hairline rounded border px-4 py-2 text-ink-bright transition hover:border-phosphor/60 hover:text-phosphor"
            >
              read the docs
            </a>
            <a
              href="/account"
              className="px-2 py-2 text-ink-dim underline-offset-4 transition hover:text-ink-bright hover:underline"
            >
              get an API key →
            </a>
          </div>
        </div>

        <div className="fade-up fade-up-2 space-y-3">
          <Terminal title="anthropic/chat · v1/messages · kind=input">
            <pre className="text-ink">
              <code>{HERO_SCHEMA}</code>
            </pre>
          </Terminal>
          <p className="truncate font-mono text-[11px] text-ink-dim">
            etag{' '}
            <span className="text-phosphor-dim">
              "817523c9788bc9ab300541d0b4af1fbf…"
            </span>{' '}
            · 304s honoured · stale-while-revalidate
          </p>
        </div>
      </header>

      {/* live numbers */}
      <section className="hairline border-y bg-panel-raised/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px sm:grid-cols-4">
          {(
            [
              ['models tracked', totals.models],
              ['endpoints', totals.endpoints],
              ['schema versions', totals.schemas],
              ['providers', status.providers.length],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="px-5 py-6">
              <div className="font-mono text-3xl text-ink-bright tabular-nums">
                {n}
              </div>
              <div className="mt-1 font-mono text-[10px] tracking-[0.2em] text-ink-dim uppercase">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* for agents */}
      <section className="mx-auto max-w-6xl space-y-6 px-5 py-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-4xl text-ink-bright">
            For agents<em className="text-phosphor">.</em>
          </h2>
          <p className="hidden font-mono text-xs text-ink-dim sm:block">
            no signup for reads · 60 req/h anonymous · 5k with a key
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Terminal title="catalog + schema, raw http">
            <pre className="whitespace-pre-wrap">
              <code>
                <span className="text-phosphor">$</span>{' '}
                {
                  'curl https://modelschemas.com/v1/models?activity=chat&q=claude'
                }
                {'\n'}
                <span className="text-phosphor">$</span>{' '}
                {
                  'curl https://modelschemas.com/v1/schemas/anthropic/chat/v1%2Fmessages'
                }
              </code>
            </pre>
          </Terminal>

          <Terminal title="validate before you spend tokens">
            <pre className="whitespace-pre-wrap">
              <code>
                <span className="text-phosphor">$</span>{' '}
                {'curl -X POST https://modelschemas.com/v1/validate \\'}
                {'\n    '}
                {`-d '{"provider":"anthropic","endpointId":"v1/messages","payload":{…}}'`}
                {'\n'}
                <span className="text-ink-dim">
                  {`→ {"valid":false,"errors":[{"path":"#","keyword":"required",…}]}`}
                </span>
              </code>
            </pre>
          </Terminal>

          <Terminal title="mcp · streamable http">
            <pre className="whitespace-pre-wrap">
              <code>
                endpoint:{' '}
                <span className="text-amber">https://modelschemas.com/mcp</span>
                {'\n'}
                tools: list_models · get_model · get_schema · validate_payload ·
                recent_changes
              </code>
            </pre>
          </Terminal>

          <Terminal title="discovery + skill install">
            <pre className="whitespace-pre-wrap">
              <code>
                <a className="text-amber hover:underline" href="/llms.txt">
                  /llms.txt
                </a>{' '}
                — agent guide{'\n'}
                <a
                  className="text-amber hover:underline"
                  href="/.well-known/agent-configuration"
                >
                  /.well-known/agent-configuration
                </a>{' '}
                — agent-auth{'\n'}
                <a className="text-amber hover:underline" href="/skill">
                  /skill
                </a>{' '}
                — drop into .claude/skills/
              </code>
            </pre>
          </Terminal>
        </div>
      </section>

      {/* providers */}
      <section className="mx-auto max-w-6xl space-y-4 px-5 pb-16">
        <h2 className="font-display text-4xl text-ink-bright">
          Providers<em className="text-phosphor">.</em>
        </h2>
        <div className="terminal">
          <table className="w-full font-mono text-[13px]">
            <thead>
              <tr className="hairline border-b text-left text-[10px] tracking-[0.2em] text-ink-dim uppercase">
                <th className="px-4 py-2 font-medium">provider</th>
                <th className="px-4 py-2 font-medium">status</th>
                <th className="px-4 py-2 text-right font-medium">models</th>
                <th className="px-4 py-2 text-right font-medium">schemas</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                  polled
                </th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                  synced
                </th>
              </tr>
            </thead>
            <tbody>
              {status.providers.map((p) => (
                <tr key={p.id} className="hairline border-b last:border-0">
                  <td className="px-4 py-2.5 text-ink-bright">
                    <a
                      className="hover:text-phosphor"
                      href={`/v1/providers/${p.id}/models`}
                    >
                      {p.displayName}
                    </a>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`pulse-dot ${STATUS_DOT[p.status] ?? 'bg-ink-dim'}`}
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
                  <td className="hidden px-4 py-2.5 text-right text-ink-dim sm:table-cell">
                    {timeAgo(p.lastPolledAt)}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right text-ink-dim sm:table-cell">
                    {timeAgo(p.lastSyncedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* change log */}
      <section className="mx-auto max-w-6xl space-y-4 px-5 pb-20">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-4xl text-ink-bright">
            Just changed<em className="text-phosphor">.</em>
          </h2>
          <a
            className="font-mono text-xs text-ink-dim hover:text-phosphor"
            href="/v1/changes"
          >
            /v1/changes →
          </a>
        </div>
        {changes.length === 0 ? (
          <p className="font-mono text-sm text-ink-dim">
            no changes yet — the next cron poll will populate this feed.
          </p>
        ) : (
          <div className="terminal px-4 py-3">
            <ol className="space-y-1.5 font-mono text-[13px]">
              {changes.map((change) => (
                <li key={change.id} className="flex items-baseline gap-3">
                  <span className="shrink-0 text-ink-dim">
                    {timeAgo(change.createdAt)}
                  </span>
                  <span
                    className={`shrink-0 ${CHANGE_STYLES[change.type] ?? 'text-ink'}`}
                  >
                    {change.type}
                  </span>
                  <span className="truncate text-ink">{change.summary}</span>
                  <span className="ml-auto hidden shrink-0 text-ink-dim sm:inline">
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

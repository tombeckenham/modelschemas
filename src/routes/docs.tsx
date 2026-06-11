import { createFileRoute } from '@tanstack/react-router'
import { Streamdown } from 'streamdown'

import { SiteFooter, SiteNav } from '#/components/site.tsx'
import { llmsTxt } from '#/server/llms-txt.ts'

export const Route = createFileRoute('/docs')({
  component: Docs,
})

const LINKS: Array<[label: string, href: string]> = [
  ['API index', '/v1'],
  ['openapi.json', '/openapi.json'],
  ['llms.txt (this content, raw)', '/llms.txt'],
  ['Agent discovery', '/.well-known/agent-configuration'],
  ['Service status', '/v1/status'],
  ['Model catalog', '/v1/models'],
  ['Changes feed', '/v1/changes'],
  ['Agent skill (SKILL.md)', '/skill'],
]

function Docs() {
  return (
    <div className="min-h-screen text-ink">
      <SiteNav active="docs" />
      <div className="mx-auto max-w-3xl space-y-10 px-5 py-14">
        <header className="space-y-3">
          <h1 className="font-display text-5xl text-ink-bright">
            Docs<em className="text-phosphor">.</em>
          </h1>
          <p className="font-mono text-xs text-ink-dim">
            rendered from the exact /llms.txt agents fetch — zero drift by
            construction.
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
            {LINKS.map(([label, href]) => (
              <a
                key={href}
                className="text-ink underline-offset-4 hover:text-phosphor hover:underline"
                href={href}
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        {/* Rendered from the exact llms.txt source so the human docs can never
            drift from what agents read. */}
        <article className="prose prose-invert prose-zinc max-w-none prose-headings:font-display prose-headings:font-normal prose-headings:text-ink-bright prose-code:text-phosphor prose-a:text-amber prose-li:marker:text-phosphor-dim">
          <Streamdown>{llmsTxt}</Streamdown>
        </article>
      </div>
      <SiteFooter />
    </div>
  )
}

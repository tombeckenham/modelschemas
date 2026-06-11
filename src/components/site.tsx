/** Shared chrome for the machine-registry theme (task 9.4). */

export function SiteNav({ active }: { active?: string }) {
  const links: Array<[label: string, href: string]> = [
    ['docs', '/docs'],
    ['openapi', '/openapi.json'],
    ['llms.txt', '/llms.txt'],
    ['status', '/v1/status'],
    ['sign in', '/login'],
    ['account', '/account'],
  ]
  return (
    <nav className="hairline sticky top-0 z-40 border-b bg-panel/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <a
          href="/"
          className="blink font-mono text-sm font-semibold tracking-tight text-ink-bright"
        >
          modelschemas
        </a>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim sm:inline">
          live model registry
        </span>
        <div className="ml-auto flex items-center gap-4 font-mono text-xs">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className={
                active === label
                  ? 'text-phosphor'
                  : 'text-ink transition-colors hover:text-phosphor'
              }
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="hairline border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 font-mono text-xs text-ink-dim">
        <span>
          agents welcome — start at{' '}
          <a className="text-ink hover:text-phosphor" href="/llms.txt">
            /llms.txt
          </a>
        </span>
        <a
          className="hover:text-phosphor"
          href="/.well-known/agent-configuration"
        >
          /.well-known/agent-configuration
        </a>
        <a className="hover:text-phosphor" href="/skill">
          /skill
        </a>
        <a className="hover:text-phosphor" href="/mcp">
          /mcp
        </a>
        <span className="ml-auto">
          openapi-described · etag-cached · cron-refreshed
        </span>
      </div>
    </footer>
  )
}

/** Terminal-styled block with a $ prompt header line. */
export function Terminal({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`terminal ${className}`}>
      <div className="hairline flex items-center gap-2 border-b px-4 py-2 text-[11px] text-ink-dim">
        <span className="h-2 w-2 rounded-full bg-signal-red/60" />
        <span className="h-2 w-2 rounded-full bg-amber/60" />
        <span className="h-2 w-2 rounded-full bg-phosphor/60" />
        <span className="ml-2 tracking-widest uppercase">{title}</span>
      </div>
      <div className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
        {children}
      </div>
    </div>
  )
}

export const CHANGE_STYLES: Record<string, string> = {
  'model.added': 'text-phosphor',
  'model.removed': 'text-signal-red',
  'model.updated': 'text-amber',
  'schema.added': 'text-phosphor',
  'schema.updated': 'text-amber',
  'endpoint.added': 'text-phosphor',
  'endpoint.removed': 'text-signal-red',
}

export const STATUS_DOT: Record<string, string> = {
  active: 'bg-phosphor',
  degraded: 'bg-amber',
  disabled: 'bg-ink-dim',
}

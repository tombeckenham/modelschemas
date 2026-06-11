/** Shared chrome for the data-broadsheet theme. */

export const GITHUB_URL = 'https://github.com/tombeckenham/modelschemas'

export function GithubIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      fill="currentColor"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

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
    <nav className="rule-double sticky top-0 z-40 bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-3">
        <a
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-ink"
        >
          modelschemas
          <span className="text-press">.</span>
        </a>
        <span className="overline-label hidden sm:inline">
          live model registry
        </span>
        <div className="ml-auto flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className={`nav-link ${active === label ? 'is-active' : ''}`}
            >
              {label}
            </a>
          ))}
          <a
            href={GITHUB_URL}
            aria-label="GitHub repository"
            className="self-center text-ink-soft transition-colors hover:text-ink"
          >
            <GithubIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="hairline border-t-2 border-t-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-6 gap-y-2 px-5 py-6 text-xs text-ink-soft">
        <span className="overline-label">colophon</span>
        <span>
          agents start at{' '}
          <a className="press-link font-mono" href="/llms.txt">
            /llms.txt
          </a>
        </span>
        <a
          className="press-link font-mono"
          href="/.well-known/agent-configuration"
        >
          /.well-known/agent-configuration
        </a>
        <a className="press-link font-mono" href="/skill">
          /skill
        </a>
        <a className="press-link font-mono" href="/mcp">
          /mcp
        </a>
        <a
          className="inline-flex items-center gap-1.5 self-center transition-colors hover:text-ink"
          href={GITHUB_URL}
        >
          <GithubIcon className="h-3.5 w-3.5" />
          <span className="font-mono">github</span>
        </a>
        <span className="ml-auto font-mono">
          openapi-described · etag-cached · cron-refreshed
        </span>
      </div>
    </footer>
  )
}

/** Boxed figure with a small-caps caption rule — the broadsheet's exhibit. */
export function Figure({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <figure className={`figure m-0 ${className}`}>
      <figcaption className="figure-caption flex items-center gap-2 px-4 py-2">
        <span aria-hidden className="text-press">
          ¶
        </span>
        {title}
      </figcaption>
      <div className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed">
        {children}
      </div>
    </figure>
  )
}

export const CHANGE_STYLES: Record<string, string> = {
  'model.added': 'text-live',
  'model.removed': 'text-press',
  'model.updated': 'text-update',
  'schema.added': 'text-live',
  'schema.updated': 'text-update',
  'endpoint.added': 'text-live',
  'endpoint.removed': 'text-press',
}

export const STATUS_DOT: Record<string, string> = {
  active: 'bg-live',
  degraded: 'bg-update',
  disabled: 'bg-ink-faint',
}

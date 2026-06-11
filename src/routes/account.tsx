import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client.ts'

export const Route = createFileRoute('/account')({
  component: Account,
})

interface KeyRow {
  id: string
  name: string | null
  start: string | null
  createdAt: string | Date
  expiresAt: string | Date | null
  enabled: boolean
}

const EXPIRY_CHOICES: Array<[label: string, seconds: number | undefined]> = [
  ['Never expires', undefined],
  ['30 days', 30 * 86_400],
  ['90 days', 90 * 86_400],
  ['1 year', 365 * 86_400],
]

function Account() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [keys, setKeys] = useState<Array<KeyRow>>([])
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState<string>('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const { data } = await authClient.apiKey.list()
    const rows = Array.isArray(data)
      ? (data as Array<KeyRow>)
      : ((data as { apiKeys?: Array<KeyRow> } | null)?.apiKeys ?? [])
    setKeys(rows)
  }

  useEffect(() => {
    if (session) void refresh()
  }, [session])

  const createKey = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const expiresIn = expiry === '' ? undefined : Number(expiry)
    const { data, error: createError } = await authClient.apiKey.create({
      name: name || 'api key',
      ...(expiresIn !== undefined ? { expiresIn } : {}),
    })
    setBusy(false)
    if (createError) {
      setError(createError.message ?? 'Could not create the key.')
      return
    }
    setCreatedKey((data as { key: string }).key)
    setName('')
    await refresh()
  }

  const revokeKey = async (keyId: string) => {
    setError(null)
    const { error: deleteError } = await authClient.apiKey.delete({ keyId })
    if (deleteError) {
      setError(deleteError.message ?? 'Could not revoke the key.')
      return
    }
    await refresh()
  }

  const inputClasses =
    'rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700'

  if (isPending) return null
  if (!session) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-8 text-sm">
        <h1 className="text-2xl font-bold tracking-tight">
          <a href="/">modelschemas</a>
        </h1>
        <p className="text-zinc-500">You need to sign in to manage API keys.</p>
        <a className="underline underline-offset-4" href="/login">
          Sign in with email →
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          <a href="/">modelschemas</a>
        </h1>
        <p className="text-sm text-zinc-500">
          Signed in as <span className="font-medium">{session.user.email}</span>{' '}
          ·{' '}
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => {
              void authClient.signOut().then(() => router.invalidate())
            }}
          >
            sign out
          </button>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">API keys</h2>
        <p className="text-sm text-zinc-500">
          Keys unlock 5,000 requests/hour (vs 60/hour anonymous) and webhook
          subscriptions. Send them as{' '}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            Authorization: Bearer &lt;key&gt;
          </code>
          .
        </p>

        {createdKey ? (
          <div className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
            <p className="font-medium">
              Key created — copy it now, it is shown exactly once:
            </p>
            <code className="block break-all rounded bg-white px-2 py-1 dark:bg-zinc-900">
              {createdKey}
            </code>
            <pre className="overflow-x-auto rounded bg-white px-2 py-1 text-xs dark:bg-zinc-900">
              {`curl https://modelschemas.com/v1/agents/me \\\n  -H "Authorization: Bearer ${createdKey}"`}
            </pre>
            <button
              type="button"
              className="text-xs underline underline-offset-4"
              onClick={() => setCreatedKey(null)}
            >
              Done, hide it
            </button>
          </div>
        ) : null}

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            void createKey(event)
          }}
        >
          <input
            className={`${inputClasses} flex-1`}
            placeholder="Key name (e.g. my laptop)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            className={inputClasses}
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          >
            {EXPIRY_CHOICES.map(([label, seconds]) => (
              <option key={label} value={seconds ?? ''}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Creating…' : 'Create key'}
          </button>
        </form>

        {keys.length === 0 ? (
          <p className="text-sm text-zinc-500">No keys yet.</p>
        ) : (
          <ul className="space-y-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
              >
                <span className="flex-1">
                  <span className="font-medium">{key.name ?? 'unnamed'}</span>{' '}
                  <code className="text-xs text-zinc-500">
                    {key.start ?? '…'}…
                  </code>
                </span>
                <span className="text-xs text-zinc-500">
                  {key.expiresAt
                    ? `expires ${new Date(key.expiresAt).toLocaleDateString()}`
                    : 'no expiry'}
                </span>
                <button
                  type="button"
                  className="text-xs text-red-600 underline underline-offset-4"
                  onClick={() => {
                    void revokeKey(key.id)
                  }}
                >
                  revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <footer className="text-xs text-zinc-500">
        Agents can self-register instead — see{' '}
        <a className="underline underline-offset-4" href="/docs">
          the docs
        </a>{' '}
        or{' '}
        <a
          className="underline underline-offset-4"
          href="/.well-known/agent-configuration"
        >
          agent discovery
        </a>
        .
      </footer>
    </div>
  )
}

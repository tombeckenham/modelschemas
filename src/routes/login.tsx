import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { SiteFooter, SiteNav } from '#/components/site.tsx'
import { authClient } from '#/lib/auth-client.ts'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    })
    setBusy(false)
    if (sendError) {
      setError(sendError.message ?? 'Could not send the code.')
      return
    }
    setStep('otp')
  }

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error: signInError } = await authClient.signIn.emailOtp({
      email,
      otp,
    })
    setBusy(false)
    if (signInError) {
      setError(signInError.message ?? 'Invalid code.')
      return
    }
    // /account lands in task 9.3; refresh session state in place for now.
    await router.invalidate()
  }

  const inputClasses =
    'hairline w-full rounded border bg-panel-raised px-3 py-2 font-mono text-sm text-ink-bright outline-none transition focus:border-phosphor/60'
  const buttonClasses =
    'w-full rounded border border-phosphor/60 bg-phosphor/10 px-3 py-2 font-mono text-sm text-phosphor transition hover:bg-phosphor/20 disabled:opacity-50'

  return (
    <div className="min-h-screen text-ink">
      <SiteNav />
      <div className="mx-auto max-w-sm space-y-6 px-5 py-16">
        <header className="space-y-2">
          <h1 className="font-display text-4xl text-ink-bright">
            Sign in<em className="text-phosphor">.</em>
          </h1>
          <p className="text-sm">
            Manage your API keys. We email you a one-time code — no password.
          </p>
        </header>

        {isPending ? null : session ? (
          <div className="space-y-3 text-sm">
            <p>
              Signed in as{' '}
              <span className="font-medium">{session.user.email}</span>
            </p>
            <a
              className="text-phosphor underline-offset-4 hover:underline"
              href="/account"
            >
              Manage API keys →
            </a>
            <button
              type="button"
              className={buttonClasses}
              onClick={() => {
                void authClient.signOut().then(() => router.invalidate())
              }}
            >
              Sign out
            </button>
          </div>
        ) : step === 'email' ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              void sendCode(event)
            }}
          >
            <input
              className={inputClasses}
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button className={buttonClasses} disabled={busy} type="submit">
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              void verifyCode(event)
            }}
          >
            <p className="text-sm text-ink-dim">
              Enter the 6-digit code sent to{' '}
              <span className="font-medium">{email}</span>.
            </p>
            <input
              className={`${inputClasses} text-center text-lg tracking-[0.4em]`}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="••••••"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
            <button className={buttonClasses} disabled={busy} type="submit">
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="w-full font-mono text-xs text-ink-dim underline underline-offset-4 hover:text-ink"
              onClick={() => setStep('email')}
            >
              Use a different email
            </button>
          </form>
        )}

        {error ? (
          <p className="font-mono text-sm text-signal-red">{error}</p>
        ) : null}
      </div>
      <SiteFooter />
    </div>
  )
}

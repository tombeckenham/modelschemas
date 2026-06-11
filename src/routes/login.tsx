import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

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
    'w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700'
  const buttonClasses =
    'w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300'

  return (
    <div className="mx-auto max-w-sm space-y-6 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          <a href="/">modelschemas</a>
        </h1>
        <p className="text-sm text-zinc-500">
          Sign in to manage your API keys. We email you a one-time code — no
          password.
        </p>
      </header>

      {isPending ? null : session ? (
        <div className="space-y-3 text-sm">
          <p>
            Signed in as{' '}
            <span className="font-medium">{session.user.email}</span>
          </p>
          <a className="underline underline-offset-4" href="/account">
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
          <p className="text-sm text-zinc-500">
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
            className="w-full text-xs text-zinc-500 underline underline-offset-4"
            onClick={() => setStep('email')}
          >
            Use a different email
          </button>
        </form>
      )}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  )
}

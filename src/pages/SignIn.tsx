import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { auth, errorMessage } from '../api.ts'
import type { User } from '../../shared/types.ts'

const inputClass =
  'h-12 w-full rounded-[10px] border border-divider bg-panel px-3.5 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

interface Props {
  onSignedIn: (user: User) => void
  /** Set while a guest is here to create an account: goes back to the cards. */
  onBack?: () => void
}

export default function SignIn({ onSignedIn, onBack }: Props) {
  const guest = onBack !== undefined
  const [mode, setMode] = useState<'signIn' | 'signUp'>(guest ? 'signUp' : 'signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signingUp = mode === 'signUp'

  async function run(action: () => Promise<User>) {
    setBusy(true)
    setError(null)
    try {
      onSignedIn(await action())
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    run(() => (signingUp ? auth.signUp : auth.signIn)(email, password))
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center px-4 py-10">
      {guest && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-2.5 mb-6 flex h-11 cursor-pointer items-center gap-1.5 self-start rounded-[10px] pr-3 pl-2 text-[15px] font-bold"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to cards
        </button>
      )}

      <div className="mb-8 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-[10px] bg-note-paper text-[22px] font-extrabold text-note-ink shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
        >
          한
        </span>
        <span className="flex flex-col">
          <span lang="ko" className="text-xl font-extrabold tracking-[-0.01em]">
            암기
          </span>
          <span className="text-[13px] text-muted">Korean vocabulary, one card at a time</span>
        </span>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel">
        <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">{signingUp ? 'Create an account' : 'Sign in'}</h1>
        {guest && (
          <p className="-mt-2 text-sm leading-snug text-body">
            {signingUp
              ? 'Everything you studied as a guest moves into your new account.'
              : 'Signing in to an existing account leaves your guest progress behind.'}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-body">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-body">Password</span>
          <input
            type="password"
            required
            minLength={signingUp ? 8 : undefined}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={signingUp ? 'password-hint' : undefined}
            className={inputClass}
          />
          {signingUp && (
            <span id="password-hint" className="text-xs text-muted">
              At least 8 characters.
            </span>
          )}
        </label>

        {error && (
          <p role="alert" className="text-sm text-again-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 min-h-12 cursor-pointer rounded-[10px] bg-switch-on px-4 text-[15px] font-bold text-white disabled:opacity-60"
        >
          {busy ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-body">
        {signingUp ? 'Already have an account?' : 'New here?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(signingUp ? 'signIn' : 'signUp')
            setError(null)
          }}
          className="cursor-pointer font-bold text-accent underline-offset-2 hover:underline"
        >
          {signingUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>

      {!guest && (
        <div className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs font-bold tracking-[0.12em] text-muted">
            <span className="h-px flex-1 bg-divider" />
            OR
            <span className="h-px flex-1 bg-divider" />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(auth.guest)}
            aria-describedby="guest-note"
            className="min-h-12 cursor-pointer rounded-[10px] bg-panel px-4 text-[15px] font-bold text-ink shadow-panel disabled:opacity-60"
          >
            Continue as guest
          </button>
          <p id="guest-note" className="text-center text-[13px] leading-snug text-muted">
            Guest progress is saved in this browser only, so you can't continue on another device. You can create an
            account later and keep it.
          </p>
        </div>
      )}
      <Link to="/privacy" className="mt-8 self-center text-[13px] font-bold text-muted underline underline-offset-2">
        Privacy
      </Link>
    </main>
  )
}

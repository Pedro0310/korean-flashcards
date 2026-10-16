import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { auth, errorMessage } from '../api.ts'
import { formatCount, groupDecks, groupMeta } from '../decks.ts'
import { setOption, useSettings, type Options } from '../settings.ts'
import { useTheme } from '../theme.ts'
import type { Deck, User } from '../../shared/types.ts'

const OPTION_SWITCHES: { key: keyof Options; label: string }[] = [
  { key: 'hanja', label: 'Hanja' },
  { key: 'romanization', label: 'Romanization' },
  { key: 'wordInfo', label: 'Word info' },
  { key: 'spanish', label: 'Spanish' },
  { key: 'english', label: 'English' },
  { key: 'tilted', label: 'Tilted card' },
]

const SUN_RAYS = 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'

const groupRowClass =
  'flex h-12 w-full shrink-0 cursor-pointer items-center justify-between rounded-[10px] bg-row px-3.5 text-ink'
const switchRowClass =
  'flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg pr-2 pl-3 text-left text-[15px] font-medium text-ink2'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function Group({ header, defaultOpen, children }: { header: ReactNode; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={groupRowClass}>
        {header}
        <Chevron open={open} />
      </button>
      {open && <div className="flex flex-col gap-0.5 pt-1 pb-1.5 pl-3">{children}</div>}
    </div>
  )
}

function DarkModeSwitch() {
  const [theme, setTheme] = useTheme()
  const dark = theme === 'dark'
  return (
    <button type="button" role="switch" aria-checked={dark} onClick={() => setTheme(dark ? 'light' : 'dark')} className={switchRowClass}>
      <span>Dark mode</span>
      <span
        aria-hidden="true"
        className={`relative flex h-[26px] w-[52px] flex-none rounded-full p-[3px] transition-colors duration-150 ${
          dark ? 'justify-end bg-switch-on text-white/55' : 'justify-start bg-[#8FB4E8] text-white/85'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="absolute top-1.5 left-1.5">
          <circle cx="12" cy="12" r="4" />
          <path d={SUN_RAYS} />
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="absolute top-[7px] right-[7px]">
          <path d={MOON} />
        </svg>
        <span className="relative flex size-5 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          {dark ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#1E3A6E" stroke="#1E3A6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={MOON} />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C98A00" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" fill="#FFC93C" />
              <path d={SUN_RAYS} />
            </svg>
          )}
        </span>
      </span>
    </button>
  )
}

/** A quiet link that opens a password check before deleting the account for good. */
function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await auth.deleteAccount(password)
      onDeleted()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="-mt-2 min-h-11 cursor-pointer self-start px-2 text-[13px] font-bold text-danger">
        Delete account
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-[10px] bg-row p-3">
      <p className="text-[13px] leading-snug text-body">
        This deletes your account, your progress and your review history. It can't be undone.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-body">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-lg border border-divider bg-panel px-3 text-[15px] text-ink outline-none focus:border-accent"
        />
      </label>
      {error && (
        <p role="alert" className="text-[13px] text-again-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 cursor-pointer rounded-[10px] bg-chip text-sm font-bold">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 flex-1 cursor-pointer rounded-[10px] bg-danger-fill text-sm font-bold text-white disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </form>
  )
}

interface Props {
  user: User
  onSignOut: () => void
  onCreateAccount: () => void
  decks: Deck[]
  selectedId: number | undefined
  onPick: (deck: Deck) => void
  onClose: () => void
}

export default function Sidebar({ user, onSignOut, onCreateAccount, decks, selectedId, onPick, onClose }: Props) {
  const { options } = useSettings()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const groups = groupDecks(decks)
  const selectedGroup = decks.find((d) => d.id === selectedId)?.groupName

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-10 bg-scrim" />
      <nav
        aria-label="Menu"
        className="fixed top-0 bottom-0 left-0 z-11 flex w-[min(284px,86vw)] flex-col gap-4 overflow-y-auto *:shrink-0 bg-panel px-4 py-6 text-ink shadow-[12px_0_32px_-12px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between pl-2">
          <div className="text-xs font-extrabold tracking-[0.12em] text-body">DECKS</div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-body"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {groups.map((group) => {
            const meta = groupMeta(group.name)
            return (
              <div key={group.name} className="contents">
                <Group
                  defaultOpen={group.name === selectedGroup}
                  header={
                    <span className="flex items-baseline gap-2">
                      <span className="text-base font-extrabold">{meta.title}</span>
                      <span lang="ko" className="text-xs text-muted">
                        {meta.sub}
                      </span>
                    </span>
                  }
                >
                  {group.decks.map((deck) => {
                    const selected = deck.id === selectedId
                    return (
                      <button
                        key={deck.id}
                        type="button"
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => onPick(deck)}
                        className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-left text-[15px] leading-[1.3] ${
                          selected ? 'bg-note font-extrabold text-note-ink' : 'font-medium text-ink2'
                        }`}
                      >
                        <span>{deck.name}</span>
                        <span className={`text-[13px] font-medium tabular-nums ${selected ? 'text-[#3F4C63]' : 'text-muted'}`}>
                          {formatCount(deck.wordCount)}
                        </span>
                      </button>
                    )
                  })}
                </Group>
              </div>
            )
          })}
        </div>

        <div className="border-t border-chip" />

        <Group
          defaultOpen
          header={
            <span className="flex items-center gap-2.5">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="8" cy="17" r="2" />
              </svg>
              <span className="text-base font-extrabold">Options</span>
            </span>
          }
        >
          {OPTION_SWITCHES.map(({ key, label }) => {
            const on = options[key]
            return (
              <button key={key} type="button" role="switch" aria-checked={on} onClick={() => setOption(key, !on)} className={switchRowClass}>
                <span>{label}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-10 flex-none rounded-full p-[3px] transition-colors duration-150 ${
                    on ? 'justify-end bg-switch-on' : 'justify-start bg-switch-off'
                  }`}
                >
                  <span className="size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                </span>
              </button>
            )
          })}
          <DarkModeSwitch />
        </Group>

        <div className="border-t border-chip" />

        {user.guest ? (
          <div className="flex flex-col gap-3 px-2">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-ink">Guest</span>
              <span className="text-[13px] leading-snug text-body">
                Your progress is saved in this browser only. Create an account to keep it and use it on other devices.
              </span>
            </div>
            <button
              type="button"
              onClick={onCreateAccount}
              className="min-h-11 cursor-pointer rounded-[10px] bg-switch-on px-3.5 text-sm font-bold text-white"
            >
              Create account
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 pl-2">
            <span className="min-w-0 truncate text-sm text-body" title={user.email ?? undefined}>
              {user.email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-11 shrink-0 cursor-pointer rounded-[10px] bg-row px-3.5 text-sm font-bold text-ink"
            >
              Sign out
            </button>
          </div>
        )}
        {!user.guest && <DeleteAccount onDeleted={onSignOut} />}

        <p className="mt-auto px-2 pt-2 text-[11px] leading-normal text-muted">
          Word list and dictionary data from the National Institute of Korean Language (
          <span lang="ko">한국어 학습용 어휘 목록</span>, KOGL Type 1; <span lang="ko">한국어기초사전</span>, CC BY-SA 2.0 KR).{' '}
          <Link to="/privacy" onClick={onClose} className="font-bold underline underline-offset-2">
            Privacy
          </Link>
        </p>
      </nav>
    </>
  )
}

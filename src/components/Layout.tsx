import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { api, errorMessage } from '../api.ts'
import { deckLabel } from '../decks.ts'
import { updateSettings, useSettings } from '../settings.ts'
import Sidebar from './Sidebar.tsx'
import type { Deck, User } from '../../shared/types.ts'

interface AppContext {
  /** Every deck, in sidebar order. Empty while loading. */
  decks: Deck[]
  /** The deck reviews work on. null while decks are loading. */
  deck: Deck | null
  /** Reload decks after something changed their word counts or progress. */
  refreshDecks: () => void
}

export const useAppContext = () => useOutletContext<AppContext>()

interface Props {
  user: User
  onSignOut: () => void
  /** For a guest: open the sign-up page. */
  onCreateAccount: () => void
}

export default function Layout({ user, onSignOut, onCreateAccount }: Props) {
  const { deckId } = useSettings()
  const onStats = useLocation().pathname === '/stats'
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const refreshDecks = useCallback(() => {
    api.decks().then(setDecks, (err) => setError(errorMessage(err)))
  }, [])

  useEffect(refreshDecks, [refreshDecks])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // Hand focus back to the menu button once the page behind the drawer is usable again.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !menuOpen) menuButtonRef.current?.focus()
    wasOpen.current = menuOpen
  }, [menuOpen])

  // The saved deck, or the first one if nothing is saved or it no longer exists.
  const deck = decks?.find((d) => d.id === deckId) ?? decks?.[0] ?? null

  return (
    <>
      <div inert={menuOpen} className="mx-auto box-content flex min-h-dvh max-w-[560px] flex-col px-[clamp(16px,5vw,36px)]">
        {onStats ? (
          <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-[clamp(20px,5vw,32px)] pb-5">
            <Link to="/" className="-ml-2.5 flex h-11 items-center gap-1.5 justify-self-start rounded-[10px] pr-3 pl-2 text-[15px] font-bold">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Review
            </Link>
            <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">Stats</h1>
          </header>
        ) : (
          <header className="-mx-2.5 flex items-center gap-3 py-[clamp(20px,5vw,32px)]">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px]"
            >
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/" className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-note-paper text-xl font-extrabold text-note-ink shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
              >
                한
              </span>
              <span className="flex min-w-0 flex-col gap-px">
                <span lang="ko" className="truncate text-[17px] font-extrabold tracking-[-0.01em]">암기</span>
                <span className="truncate text-xs text-muted">{deck ? deckLabel(deck) : ' '}</span>
              </span>
            </Link>
            <Link
              to="/stats"
              className="ml-auto flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-panel px-3.5 text-[15px] font-bold shadow-panel"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </svg>
              {/* Icon only on the narrowest phones, so the app title fits. */}
              <span className="max-[400px]:sr-only">Stats</span>
            </Link>
          </header>
        )}
        <main className="flex-1 pb-10">
          {error && !decks ? (
            <p className="pt-20 text-center text-sm text-again-ink">{error}</p>
          ) : (
            <Outlet context={{ decks: decks ?? [], deck, refreshDecks } satisfies AppContext} />
          )}
        </main>
      </div>

      {menuOpen && (
        <Sidebar user={user} onSignOut={onSignOut} onCreateAccount={onCreateAccount} decks={decks ?? []} selectedId={deck?.id} onPick={(d) => updateSettings({ deckId: d.id })} onClose={closeMenu} />
      )}
    </>
  )
}

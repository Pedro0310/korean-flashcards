import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../api.ts'
import Flashcard from '../components/Flashcard.tsx'
import { useAppContext } from '../components/Layout.tsx'
import { useSettings } from '../settings.ts'
import type { IntervalPreview, Rating, Word } from '../../shared/types.ts'

export default function Review() {
  const { deck } = useAppContext()
  const deckId = deck?.id
  const [queue, setQueue] = useState<Word[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<IntervalPreview[] | null>(null)

  const shownAt = useRef(0)
  const { options } = useSettings()

  // (Re)start the session whenever the selected deck changes.
  useEffect(() => {
    if (deckId === undefined) return
    let stale = false
    setQueue(null)
    setRevealed(false)
    setFinished(0)
    setError(null)
    api.dueWords(deckId).then(
      (words) => stale || setQueue(words),
      (err) => stale || setError(errorMessage(err)),
    )
    return () => {
      stale = true
    }
  }, [deckId])

  const current = queue?.[0]

  // A card came up: start timing it and fetch what each answer would do.
  // (A card that comes back later in the session is a new object, so this reruns.)
  useEffect(() => {
    if (!current) return
    let stale = false
    shownAt.current = performance.now()
    setPreview(null)
    api.reviewPreview(current.id).then(
      (p) => stale || setPreview(p),
      () => {}, // The buttons still work without their interval labels.
    )
    return () => {
      stale = true
    }
  }, [current])

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || busy) return
      setBusy(true)
      setError(null)
      try {
        const durationMs = Math.round(performance.now() - shownAt.current)
        const updated = await api.review(current.id, rating, durationMs)

        // Cards still being learned (due again in minutes) go to the back of
        // this session's queue; the rest are done until their next due date.
        const stillLearning = updated.intervalDays === 0
        setQueue((q) => {
          // The deck was switched while this answer was being saved.
          if (q?.[0]?.id !== updated.id) return q
          const rest = q.slice(1)
          return stillLearning ? [...rest, updated] : rest
        })
        if (!stillLearning) setFinished((n) => n + 1)
        setRevealed(false)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setBusy(false)
      }
    },
    [current, busy],
  )

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        rate(Number(e.key) as Rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, revealed, rate])

  if (error && !queue) return <p className="pt-20 text-center text-sm text-again-ink">{error}</p>
  if (!queue) return null

  if (!current) {
    const empty = deck?.wordCount === 0
    return (
      <div className="pt-24 text-center">
        <p className="text-4xl">{empty ? '시작!' : '잘했어요!'}</p>
        <p className="mt-4 text-body">
          {empty
            ? 'No words in this deck yet.'
            : finished > 0
              ? `All caught up. You finished ${finished} ${finished === 1 ? 'card' : 'cards'}.`
              : 'All caught up. Nothing is due right now.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <Flashcard
        key={current.id}
        word={current}
        revealed={revealed}
        options={options}
        preview={preview}
        disabled={busy}
        onReveal={() => setRevealed(true)}
        onRate={rate}
      />
      {error && (
        <p role="alert" className="mt-2.5 text-center text-[13px] text-again-ink">
          {error}
        </p>
      )}
    </div>
  )
}

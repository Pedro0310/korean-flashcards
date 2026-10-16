import type { ReactNode } from 'react'
import type { Options } from '../settings.ts'
import type { IntervalPreview, Rating, Word } from '../../shared/types.ts'

const ANSWERS: { rating: Rating; label: string; className: string }[] = [
  { rating: 1, label: 'Again', className: 'bg-again text-again-ink' },
  { rating: 2, label: 'Hard', className: 'bg-hard text-hard-ink' },
  { rating: 3, label: 'Good', className: 'bg-good text-good-ink' },
  { rating: 4, label: 'Easy', className: 'bg-easy text-easy-ink' },
]

/**
 * The example sentence with the word marked. Verbs and adjectives are stored
 * in dictionary form (먹다) but appear conjugated (먹어요), so when the word
 * itself isn't in the sentence, the part of the sentence that starts with its
 * stem is marked instead. If neither is found, nothing is marked.
 */
function highlight(sentence: string, word: string): ReactNode {
  let start = sentence.indexOf(word)
  let length = word.length
  if (start === -1 && word.length > 1 && word.endsWith('다')) {
    const stem = word.slice(0, -1)
    const match = new RegExp(`(?<=^|\\s)${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[가-힣]*`).exec(sentence)
    if (match) {
      start = match.index
      length = match[0].length
    }
  }
  if (start === -1) return sentence
  return (
    <>
      {sentence.slice(0, start)}
      <span className="bg-highlight font-bold">{sentence.slice(start, start + length)}</span>
      {sentence.slice(start + length)}
    </>
  )
}

function Translation({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="rounded-[3px] bg-chip px-[5px] py-px text-[10px] font-bold text-chip-text">{lang}</span>
      <span>{children}</span>
    </div>
  )
}

function Meaning({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-sm bg-navy px-[7px] py-0.5 text-[11px] font-bold text-white">{lang}</span>
      <span className="text-base font-bold">{children}</span>
    </div>
  )
}

interface Props {
  word: Word
  revealed: boolean
  options: Options
  /** Next interval per answer button; null while it is loading. */
  preview: IntervalPreview[] | null
  disabled: boolean
  onReveal: () => void
  onRate: (rating: Rating) => void
}

export default function Flashcard({ word, revealed, options, preview, disabled, onReveal, onRate }: Props) {
  const meaningEn = options.english ? word.meaning : null
  const meaningEs = options.spanish ? word.meaningEs : null
  const exampleEn = options.english ? word.exampleEn : null
  const exampleEs = options.spanish ? word.exampleEs : null
  const romanization = options.romanization ? word.romanization : null
  const wordInfo = options.wordInfo && revealed ? word.partOfSpeech : null

  // The big word shrinks to fit the note: each Hangul syllable is 1em wide,
  // and a phrase can wrap at its spaces, so the longest part decides.
  const widest = Math.max(...word.korean.split(/\s+/).map((part) => [...part].length))

  return (
    <div className="flex flex-col items-center gap-[clamp(20px,5vw,28px)]">
      <div
        className={`relative mt-1.5 w-full max-w-[500px] transition-transform duration-[250ms] ${options.tilted ? '-rotate-[1.6deg]' : ''}`}
      >
        <div
          aria-hidden="true"
          className={`absolute -top-3.5 left-1/2 z-1 -ml-[55px] h-7 w-[110px] bg-tape shadow-[0_1px_2px_rgba(0,0,0,0.10)] transition-transform duration-[250ms] ${options.tilted ? 'rotate-2' : ''}`}
        />
        <div className="@container relative flex flex-col items-center gap-2.5 rounded-note bg-note-paper px-[clamp(16px,6vw,32px)] pt-[clamp(22px,6vw,30px)] pb-[26px] text-note-ink shadow-note">
          {options.hanja && word.hanja && (
            // Beside a short word, as in the design; a long word fills the
            // note's width, so there the Hanja gets its own line above it.
            <div
              lang="ko-Hani"
              className={`font-serif text-[clamp(20px,6vw,30px)] leading-[1.1] font-semibold text-note-ink2 ${
                widest <= 3 ? 'absolute top-[clamp(18px,6vw,40px)] right-[clamp(12px,5vw,30px)]' : '-mt-1.5 -mb-1 self-end'
              }`}
            >
              {word.hanja}
            </div>
          )}
          <div
            lang="ko"
            className="text-center leading-[1.05] font-extrabold tracking-[-0.02em] break-keep"
            style={{ fontSize: `min(clamp(64px, 19vw, 104px), ${(98 / widest).toFixed(2)}cqw)` }}
          >
            {word.korean}
          </div>
          {(romanization || wordInfo) && (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {romanization && <span className="font-mono text-xl font-medium text-note-ink2">{romanization}</span>}
              {wordInfo && <span className="rounded-[5px] bg-navy px-2 py-[3px] text-xs font-bold text-white">{wordInfo}</span>}
            </div>
          )}
          {revealed && (meaningEn || meaningEs) && (
            <>
              <div className="mt-1.5 mb-1 w-full border-t-[1.5px] border-dashed border-note-ink/35" />
              <div className="flex w-full flex-wrap justify-center gap-x-9 gap-y-2.5">
                {meaningEn && <Meaning lang="EN">{meaningEn}</Meaning>}
                {meaningEs && <Meaning lang="ES">{meaningEs}</Meaning>}
              </div>
            </>
          )}
        </div>
      </div>

      {revealed && word.example && (
        <div className="flex w-full flex-col gap-3.5 rounded-panel bg-panel px-[clamp(16px,4vw,22px)] py-[clamp(16px,4vw,20px)] shadow-panel">
          <div className="text-xs font-extrabold tracking-[0.12em] text-body">EXAMPLE</div>
          <div className="flex flex-col gap-1.5">
            <div lang="ko" className="text-[19px] font-medium">
              {highlight(word.example, word.korean)}
            </div>
            {(exampleEn || exampleEs) && (
              <div className="flex flex-col gap-[3px] text-[13px] text-body">
                {exampleEn && <Translation lang="EN">{exampleEn}</Translation>}
                {exampleEs && <Translation lang="ES">{exampleEs}</Translation>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full">
        {revealed ? (
          <div role="group" aria-label="How well did you remember?" className="grid grid-cols-4 gap-2">
            {ANSWERS.map(({ rating, label, className }) => {
              const next = preview?.find((p) => p.rating === rating)
              return (
                <button
                  key={rating}
                  type="button"
                  disabled={disabled}
                  aria-label={next ? `${label}, see again ${next.spoken}` : label}
                  onClick={() => onRate(rating)}
                  className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-transparent px-1 py-2 disabled:opacity-60 ${className}`}
                >
                  <span className="min-h-[18px] text-xs font-medium text-muted tabular-nums">{next?.interval}</span>
                  <span className="text-base font-extrabold">{label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={onReveal}
            className="min-h-16 w-full cursor-pointer rounded-xl bg-navy text-base font-extrabold text-white"
          >
            Show answer
          </button>
        )}
      </div>
    </div>
  )
}

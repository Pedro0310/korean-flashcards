# Design handoff: Korean Flashcards

The design for the review card, sidebar and Stats screen, made on a Claude canvas.
Implement it in this app (React 19 + Tailwind 4 + Hono + Postgres).

- `Main.dc.html`: the review screen with the sidebar.
- `Stats.dc.html`: the Stats screen.

The two `.dc.html` files are **reference source, not app code**. They need the canvas
runtime to render, so don't import or serve them. Read them for exact markup, sizes,
colors and behavior; the logic each one uses is in the `<script type="text/x-dc">` block at
the bottom. All numbers on the Stats screen in the design are **sample data**. The real app
computes them from `words` and `reviews`.

---

## 1. Design tokens

Put these in `src/index.css` under `@theme` (light) and a dark-mode override. Dark mode is
a user toggle (class on `<html>`), not just `prefers-color-scheme`.

| Token | Light | Dark | Used for |
|---|---|---|---|
| bg | `#EDF1F7` | `#0F1520` | page background |
| grid | `#DFE6F0` | `#172030` | 24px graph-paper lines on the background |
| panel | `#FFFFFF` | `#1A2333` | cards, sidebar, Stats sections |
| text | `#1B2433` | `#E8EEF7` | primary text |
| body | `#3F4C63` | `#B4C0D3` | secondary text, section labels |
| muted | `#55627A` | `#9AA8BF` | captions, counts |
| ink2 | `#2B3A52` | `#CCD6E6` | sidebar rows, option labels |
| row | `#F0F4FA` | `#243044` | sidebar group headers |
| chip | `#E6EDF7` | `#2A364A` | small EN/ES chips, tracks, dividers |
| chipText | `#1E3A6E` | `#D2DEF0` | text on chips |
| divider | `#D3DCE8` | `#334058` | dashed dividers |
| navy | `#1E3A6E` | `#1E3A6E` | tags on the note (white text) |
| accent | `#2563EB` | `#60A5FA` | progress bar, Stats accents |
| switchOn | `#1E3A6E` | `#3B82F6` | switches when on |
| switchOff | `#C3CEDD` | `#46546C` | switches when off |
| note | `#C9DEFB` | `#C9DEFB` | sticky note color (also highlight, selected row) |

- Sticky note surface: `linear-gradient(155deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,0) 70%), var(--note)`.
  Text on the note always uses the light-mode ink (`#1B2433`, `#2B3A52`), in both themes.
- Highlight behind the word in the example: `linear-gradient(transparent 58%, <note> 58%)`;
  in dark mode use the note color at ~40% alpha.
- Panel shadow: light `0 8px 24px -10px rgba(27,36,51,.25)`, dark `0 8px 24px -10px rgba(0,0,0,.6)`.
- Radii: note 4px, panels 14px, buttons/rows 8–12px.

**Answer button colors (do not change):**

| | Light bg / text | Dark bg / text |
|---|---|---|
| Again | `#FDECEA` / `#B42318` | `#3A2326` / `#FF9F93` |
| Hard | `#FFF1D6` / `#8A5300` | `#3A3020` / `#F2C36B` |
| Good | `#E2F4E7` / `#1E6B3A` | `#1F3328` / `#8BD9A6` |
| Easy | `#E2ECFA` / `#1D4F91` | `#1F2A3D` / `#9CC2F5` |

**Fonts:** Noto Sans KR (400/500/700/800) for UI and Hangul, Noto Serif KR 600 for Hanja,
IBM Plex Mono 500 for romanization. Load from Google Fonts.

**Responsive:** one centered column, `max-width: 560px` (note 500px), side padding
`clamp(16px, 5vw, 36px)`. Big word: `clamp(64px, 19vw, 104px)`. Touch targets ≥ 44px.
The sidebar is a drawer over the page, `width: min(284px, 86vw)`.

---

## 2. Review screen (`Main.dc.html`)

Top to bottom:

1. **Header:** menu button (opens the sidebar) · app icon (한 on a small note) · "Korean
   Flashcards" + current deck name below it · **Stats** button on the right (goes to `/stats`).
2. **Sticky note** (tilted −1.6° with a strip of tape, unless "Tilted card" is off):
   - Big Hangul word, centered.
   - Hanja top-right (e.g. 大박), serif.
   - Romanization (mono) + word-info tag (e.g. "noun · slang", navy tag).
   - Dashed divider, then meanings: `EN awesome; jackpot` and `ES ¡brutal!; increíble`.
3. **Example panel:** label "EXAMPLE", one Korean sentence with the word highlighted, then
   the EN and ES translations, each with a small chip.
4. **Answer buttons:** four in a row (Again / Hard / Good / Easy), each showing the
   **next interval above its label** (e.g. `<1m`, `6m`, `10m`, `4d`). Below: a live line,
   "You'll see 대박 again in 4 days" after answering.

Each Options switch hides its piece: Hanja, romanization, word info, Spanish (meaning + example
line), English (meaning + example line). If both languages are off, hide the meanings divider.

Keep the app's current flow: **Space/Enter reveals, keys 1–4 answer.** The design shows the
revealed state; before reveal, show only the word (and Hanja/romanization if on) with a
"Show answer" button.

### Sidebar (drawer from the left, dim scrim behind; click scrim or ✕ to close)

- Label "DECKS".
- **TOPIK I · 초급** (dropdown): Level 1 — 800, Level 2 — 1,200.
- **TOPIK II · 중·고급**: Level 3 — 1,000, Level 4 — 1,500, Level 5 — 2,000, Level 6 — 3,500.
- Section label "KING SEJONG INSTITUTE", then dropdowns:
  - **Beginner · 초급**: King Sejong Institute Korean 1, Korean 2
  - **Intermediate · 중급**: Korean 3A, 3B, 4A, 4B
  - **Advanced · 고급**: Korean 5A, 5B, 6A, 6B
  (word counts unknown for now: show the real count from the DB.)
- The selected deck row uses the note color as background. Picking one changes the deck
  for reviews.
- **Options** (dropdown) with switches: Hanja · Romanization · Word info · Spanish · English ·
  Tilted card · Dark mode (a bigger switch with a sun on the knob in light mode and a moon in
  dark; small sun/moon icons on the track).
- Also keep a link to the existing **Words** page (add/edit/delete words) somewhere in the
  sidebar; it isn't in the design but the app needs it.

All Options and the selected deck should persist (localStorage is fine for now; a
`user_settings` table later).

---

## 3. Stats screen (`Stats.dc.html`, new route `/stats`)

Header: "‹ Review" back link · "Stats" title. (Drop the "SAMPLE DATA" chip in the app.)

1. **Deck dropdown:** "DECK <name> <n words>". Options: All decks, then TOPIK I, TOPIK II,
   King Sejong Beginner/Intermediate/Advanced groups. Everything below follows the selection.
2. **Progress card:**
   - Deck name and `learned / total` in the top-right (e.g. **124** / 800); progress bar;
     "15.5% learned · 676 words to go".
   - **New words per day:** − / number / + stepper (1–100) and quick picks 5 / 10 / 20 / 30.
     Saved **per deck**. Only new words count; reviews don't.
   - Message: "If you do 10 new words a day, you'll finish Level 1 in 68 days — around Dec 18,
     2026." Empty deck: "Add words to <deck> to see how long it will take."
3. **Reviews heatmap:** a full calendar year, one column per week (Monday first), month labels on top,
   ‹ ○ › buttons to change year (○ = this year). Future days dimmed, today outlined.
   5-step blue ramp by reviews per day: light `#E3EAF3 #BFDBFE #7FB2F5 #3B82F6 #1D4ED8`,
   dark `#1E2838 #1E3A66 #2457A6 #3B82F6 #93C5FD`. Hover shows "Oct 11, 2026: 23 reviews".
   Footer: year · total reviews, Less → More legend. Below: **Time today · Longest streak ·
   Current streak**.
4. **Card retention:** big "87% of cards retained" + change vs last month, then a smooth
   two-series **area chart** by month (last 6 months): Young `#3B82F6` (dark `#5B9BF5`) and
   Mature `#1E40AF` (dark `#A9CDFB`), y-axis 60–100%, legend, hover per month.
   Retention = passed (rating ≥ 2) ÷ all reviews, counting only reviews where
   `interval_before >= 1` day (Anki's rule). Young = interval < 21 days, Mature ≥ 21.
5. **Card counts:** one stacked bar + legend: New / Learning / Young / Mature, light→dark blue
   `#BFD6F6 #7FB2F5 #3B82F6 #1E40AF` (dark `#2A4A7A #3D6FC0 #5B9BF5 #A9CDFB`).
   New = never reviewed; Learning = `repetitions = 0` but reviewed; Young = interval < 21;
   Mature = interval ≥ 21.
6. **Answer buttons:** horizontal bars with the % of answers per button, in the answer colors.
7. **Reset button** (bottom): "Reset Level 1" / "Reset all decks". Opens an inline confirm
   box (not a browser dialog): "This clears your progress, review history and stats for 800
   words. The words stay in the deck as new cards. This can't be undone." Cancel / Reset.

Empty states: "No reviews in this deck yet", "No reviews with an interval of 1 day or more
yet", dashes on the answer-button chart.

---

## 4. Data the design needs (not in the current schema)

The current schema has `words` (korean, meaning, romanization, example,
example_translation, notes + SRS state) and `reviews`. The design needs:

- **`decks`** table: `id, user_id, name, group_name` (e.g. "TOPIK I", "King Sejong ·
  Intermediate"), `sort_order`, `new_per_day int default 10`. And `words.deck_id`.
  Seed the 16 decks listed above.
- On `words`: `hanja`, `part_of_speech` (e.g. "noun · slang"), `meaning_es`, and split
  example translations into `example_en` / `example_es` (`meaning` stays the English one).
- Scheduling: the review queue should respect the deck's `new_per_day` (count today's first
  reviews of new cards).
- Endpoints:
  - `GET /api/decks` (with word counts)
  - `GET /api/reviews/due?deck=…`
  - `GET /api/reviews/preview/:wordId` → the four next intervals for the buttons. Reuse
    `schedule()` for each rating; format as `<1m`, `10m`, `1d`, `4d`, `3mo`.
  - `GET /api/stats?deck=…|all` → progress, card counts, answer-button %, monthly
    retention (young/mature), streaks, time today
  - `GET /api/stats/heatmap?deck=…&year=…` → `{ "2026-10-11": 23, … }`
  - `PATCH /api/decks/:id` (new_per_day)
  - `POST /api/decks/:id/reset` and `POST /api/decks/reset-all`: delete that deck's
    reviews and set its words back to the initial SRS state, in one transaction
- **Time today:** add `duration_ms` to `reviews` (time from showing the card to answering),
  then sum today's.

Keep every query filtered by `user_id`, as the existing code does.

---

## 5. Suggested build order

1. Tokens + fonts + dark-mode class toggle in `index.css`.
2. Migration `002_decks_and_fields.sql` + seed decks; update `shared/types.ts`.
3. Sidebar drawer with decks and Options (persisted settings).
4. New review card (note, example panel, answer buttons with interval preview).
5. `/stats` route: deck dropdown, progress + daily goal, heatmap, retention chart, card
   counts, answer buttons, reset.
6. Check at phone width (~360px) and desktop, in light and dark.

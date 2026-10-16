import { useEffect, useRef } from 'react'
import { formatCount } from '../../decks.ts'
import type { Heatmap as HeatmapData } from '../../../shared/types.ts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const RAMP = [0, 1, 2, 3, 4].map((step) => `var(--color-heat-${step})`)

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Which of the five colours a day gets for its number of reviews. */
const step = (n: number) => (n === 0 ? 0 : n < 8 ? 1 : n < 16 ? 2 : n < 26 ? 3 : 4)

interface Props {
  year: number
  /** Reviews per day for that year; null while loading. */
  data: HeatmapData | null
}

/** A calendar year of reviews: one column per week (Monday first), one square per day. */
export default function Heatmap({ year, data }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const today = new Date()
  const todayKey = dayKey(today)

  const jan1 = new Date(year, 0, 1)
  const gridStart = addDays(jan1, -((jan1.getDay() + 6) % 7)) // the Monday on or before Jan 1
  const daysToDec31 = Math.round((new Date(year, 11, 31).getTime() - gridStart.getTime()) / 86_400_000)
  const weeks = Math.ceil((daysToDec31 + 1) / 7)

  // A month's label goes above the first column that starts in it.
  const monthLabels: string[] = []
  let prevMonth = -1
  for (let w = 0; w < weeks; w++) {
    let first = addDays(gridStart, w * 7)
    if (first.getFullYear() < year) first = jan1
    const month = first.getMonth()
    monthLabels.push(month !== prevMonth && first.getFullYear() === year && w < weeks - 2 ? MONTHS[month] : '')
    prevMonth = month
  }

  let total = 0
  const cells = Array.from({ length: weeks * 7 }, (_, k) => {
    const day = addDays(gridStart, k)
    const key = dayKey(day)
    const inYear = day.getFullYear() === year
    const future = key > todayKey
    const n = data?.[key] ?? 0
    if (inYear) total += n
    return { key, inYear, future, isToday: key === todayKey, n, label: `${MONTHS[day.getMonth()]} ${day.getDate()}, ${year}` }
  })

  // On a narrow screen the year is wider than the panel: bring today into view.
  const todayWeek = year === today.getFullYear() ? Math.floor(cells.findIndex((c) => c.isToday) / 7) : -1
  useEffect(() => {
    const el = scroller.current
    if (!el || todayWeek < 0) return
    el.scrollLeft = ((todayWeek + 0.5) / weeks) * el.scrollWidth - el.clientWidth / 2
  }, [todayWeek, weeks])

  const columns = { gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }

  return (
    <>
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-[500px] flex-col gap-1">
          <div aria-hidden="true" className="grid h-[13px] gap-0.5 text-[10px] text-muted" style={columns}>
            {monthLabels.map((label, w) => (
              <div key={w} className="whitespace-nowrap">
                {label}
              </div>
            ))}
          </div>
          <div
            role="img"
            aria-label={`Daily review heatmap for ${year}, ${formatCount(total)} ${total === 1 ? 'review' : 'reviews'}`}
            className="grid grid-flow-col grid-rows-7 gap-0.5 pt-0.5"
            style={columns}
          >
            {cells.map((cell) => (
              <div
                key={cell.key}
                title={
                  cell.inYear
                    ? `${cell.label}: ${cell.future ? 'upcoming' : `${formatCount(cell.n)} ${cell.n === 1 ? 'review' : 'reviews'}`}`
                    : undefined
                }
                className={`aspect-square rounded-xs ${cell.future && cell.inYear ? 'opacity-55' : ''} ${cell.isToday ? 'outline-[1.5px] outline-offset-1 outline-ink' : ''}`}
                style={{ background: cell.inYear ? RAMP[step(cell.n)] : 'transparent' }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className="text-[13px] font-bold text-body tabular-nums">
          {year}
          <span className="font-normal text-muted">
            {' '}
            · {formatCount(total)} {total === 1 ? 'review' : 'reviews'}
          </span>
        </span>
        <span aria-hidden="true" className="flex items-center gap-1">
          <span className="mr-1">Less</span>
          {RAMP.map((color) => (
            <span key={color} className="size-[11px] rounded-xs" style={{ background: color }} />
          ))}
          <span className="ml-1">More</span>
        </span>
      </div>
    </>
  )
}

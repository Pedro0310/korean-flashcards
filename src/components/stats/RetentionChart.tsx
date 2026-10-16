import type { Stats } from '../../../shared/types.ts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The SVG's own coordinate space; it stretches to whatever size the chart is.
const W = 500
const H = 180
// The y axis runs from 60% to 100%; anything lower sits on the bottom line.
const LOW = 60
const HIGH = 100
const GRID = [100, 90, 80, 70, 60]

type Point = [x: number, y: number]

const yFraction = (value: number) => (HIGH - Math.max(LOW, Math.min(HIGH, value))) / (HIGH - LOW)

/** A smooth curve through the points (Catmull-Rom converted to cubic Béziers). */
function smooth(points: Point[]): string {
  if (points.length === 0) return ''
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

function series(values: (number | null)[]) {
  const last = values.length - 1
  const points = values.flatMap((v, i): Point[] => (v === null ? [] : [[(i / last) * W, yFraction(v) * H]]))
  const line = smooth(points)
  const area = points.length > 1 ? `${line} L${points.at(-1)![0]} ${H} L${points[0][0]} ${H} Z` : ''
  return { line, area, points }
}

const monthName = (month: string) => MONTHS[Number(month.slice(5)) - 1]
const pct = (value: number | null) => (value === null ? '—' : `${value}%`)

/** Monthly retention for young and mature cards over the last six months. */
export default function RetentionChart({ retention }: { retention: Stats['retention'] }) {
  const withData = retention.filter((m) => m.all !== null)
  if (withData.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-[10px] border border-dashed border-line px-4 text-center text-[13px] text-muted">
        No reviews with an interval of 1 day or more yet
      </div>
    )
  }

  // The headline is the most recent month that has reviews, compared with the month before it.
  const latestIndex = retention.findLastIndex((m) => m.all !== null)
  const latest = retention[latestIndex]
  const before = retention[latestIndex - 1]?.all ?? null
  const isThisMonth = latestIndex === retention.length - 1
  const change = before === null ? null : latest.all! - before

  const young = series(retention.map((m) => m.young))
  const mature = series(retention.map((m) => m.mature))
  const describe = (key: 'young' | 'mature') => retention.map((m) => (m[key] === null ? 'none' : `${m[key]}%`)).join(', ')

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[34px] font-extrabold tracking-[-0.02em] tabular-nums">{latest.all}%</span>
        <span className="text-[15px] font-bold text-body">of cards retained{isThisMonth ? '' : ` in ${monthName(latest.month)}`}</span>
        {change !== null && (
          <span className="text-[13px] text-muted">
            {change >= 0 ? '+' : '−'}
            {Math.abs(change)} pts vs {isThisMonth ? 'last month' : 'the month before'}
          </span>
        )}
      </div>

      <div className="flex gap-4 text-[13px] text-body">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-young" />
          Young
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-mature" />
          Mature
        </span>
      </div>

      <div className="relative ml-[34px] h-[180px]">
        {GRID.map((value) => (
          <div
            key={value}
            aria-hidden="true"
            className={`absolute right-0 left-0 border-t ${value === LOW ? 'border-axis' : 'border-dashed border-gridline'}`}
            style={{ top: `${yFraction(value) * 100}%` }}
          >
            <span className="absolute -top-[7px] -left-[34px] text-[10px] text-muted tabular-nums">{value}%</span>
          </div>
        ))}
        <svg
          role="img"
          aria-label={`Monthly retention, ${monthName(retention[0].month)} to ${monthName(retention.at(-1)!.month)}. Young: ${describe('young')}. Mature: ${describe('mature')}`}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          <path d={young.area} className="fill-young" fillOpacity="0.28" />
          <path d={mature.area} className="fill-mature" fillOpacity="0.32" />
          <path d={young.line} fill="none" className="stroke-young" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d={mature.line} fill="none" className="stroke-mature" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Dots, so a month is visible even when it is the only one with data. Drawn
            in HTML because the SVG is stretched and would squash circles. */}
        {[
          { points: young.points, className: 'bg-young' },
          { points: mature.points, className: 'bg-mature' },
        ].map(({ points, className }) =>
          points.map(([x, y]) => (
            <span
              key={`${className}-${x}`}
              aria-hidden="true"
              className={`absolute size-[7px] -translate-1/2 rounded-full ring-2 ring-panel ${className}`}
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
            />
          )),
        )}
        <div className="absolute inset-0 flex">
          {retention.map((m) => (
            <div key={m.month} className="flex-1" title={`${monthName(m.month)} · Young ${pct(m.young)} · Mature ${pct(m.mature)}`} />
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="ml-[34px] flex justify-between text-[11px] text-muted">
        {retention.map((m) => (
          <span key={m.month}>{monthName(m.month)}</span>
        ))}
      </div>
    </>
  )
}

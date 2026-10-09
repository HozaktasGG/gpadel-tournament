'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ScoreRow = { id: string; score: number; change: number; reason: string | null; created_at: string }

type Range = '3m' | '6m' | 'all'
const RANGES: { value: Range; label: string; months: number | null }[] = [
  { value: '3m', label: '3 months', months: 3 },
  { value: '6m', label: '6 months', months: 6 },
  { value: 'all', label: 'All time', months: null },
]

// Chart colors (tokens): single series → brand orange line, green area wash, recessive grid.
const LINE = 'rgb(255 107 53)'
const SURFACE = 'rgb(13 38 32)'
const GRID = 'rgb(255 255 255 / 0.07)'
const AXIS = 'rgb(138 161 152)'

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtFull = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function inRange(rows: ScoreRow[], months: number | null) {
  if (!months) return rows
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return rows.filter(r => new Date(r.created_at) >= cutoff)
}

/** Rating progress: one series over time, crosshair tooltip, latest point labelled, table view below. */
export function RatingChart({ rows }: { rows: ScoreRow[] }) {
  // Default to the shortest range that has at least two points.
  const initial = (RANGES.find(r => inRange(rows, r.months).length >= 2)?.value ?? 'all') as Range
  const [range, setRange] = useState<Range>(initial)
  const [showTable, setShowTable] = useState(false)
  const data = useMemo(
    () => inRange(rows, RANGES.find(r => r.value === range)!.months).map(r => ({ ...r, ts: new Date(r.created_at).getTime() })),
    [rows, range]
  )
  const lastIndex = data.length - 1
  // Month ticks for long ranges, day ticks when the data spans only a few weeks.
  const spanDays = data.length > 1 ? (data[lastIndex].ts - data[0].ts) / 86_400_000 : 0

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <h2 className="font-display text-xl font-semibold">Rating progress</h2>
        <div role="group" aria-label="Time range" className="inline-flex rounded-full border border-border bg-pitch-950/60 p-0.5">
          {RANGES.map(r => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                'h-11 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium transition-colors',
                range === r.value ? 'bg-foreground text-pitch-950' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="flex h-44 items-center justify-center rounded-xl border border-dashed border-border-strong text-sm text-muted-foreground">
          No rating changes in this period.
        </p>
      ) : (
        <div className="h-44 w-full md:h-56" role="img" aria-label={`Rating from ${data[0].score} to ${data[lastIndex].score}`}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 22, right: 18, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(95 208 138)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="rgb(95 208 138)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={v =>
                  new Date(v).toLocaleDateString('en-US', spanDays > 75 ? { month: 'short' } : { month: 'short', day: 'numeric' })
                }
                tick={{ fill: AXIS, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                domain={[(min: number) => Math.floor((min - 30) / 50) * 50, (max: number) => Math.ceil((max + 30) / 50) * 50]}
                tick={{ fill: AXIS, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: 'rgb(255 255 255 / 0.25)', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <div className="rounded-xl border border-border-strong bg-popover px-3 py-2 text-sm shadow-elevated">
                      <p className="text-xs text-muted-foreground">{fmtFull(p.created_at)}</p>
                      <p className="font-display text-lg font-semibold tabular">
                        {p.score}{' '}
                        <span className={cn('text-sm', p.change > 0 ? 'text-success' : p.change < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                          {p.change > 0 ? `+${p.change}` : p.change}
                        </span>
                      </p>
                      {p.reason && <p className="max-w-[200px] truncate text-xs text-muted-foreground">{p.reason}</p>}
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={LINE}
                strokeWidth={2}
                fill="url(#ratingFill)"
                dot={{ r: 4, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive
                animationDuration={700}
              >
                <LabelList
                  dataKey="score"
                  content={({ x, y, value, index }) =>
                    index === lastIndex ? (
                      <text x={Number(x)} y={Number(y) - 12} textAnchor="end" fill="rgb(244 247 245)" fontSize={13} fontWeight={600}>
                        {value}
                      </text>
                    ) : null
                  }
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowTable(v => !v)}
            aria-expanded={showTable}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {showTable ? 'Hide rating history' : 'Show rating history'}
            <ChevronDown className={cn('size-4 transition-transform', showTable && 'rotate-180')} aria-hidden />
          </button>
          {showTable && (
            <table className="mt-1 w-full text-sm">
              <caption className="sr-only">Rating history</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-subtle">
                  <th scope="col" className="py-2 font-medium">Date</th>
                  <th scope="col" className="py-2 font-medium">Reason</th>
                  <th scope="col" className="py-2 text-right font-medium">Change</th>
                  <th scope="col" className="py-2 text-right font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map(r => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">{fmtDay(r.created_at)}</td>
                    <td className="max-w-0 truncate py-2.5 pr-3">{r.reason ?? '—'}</td>
                    <td className={cn('py-2.5 text-right tabular', r.change > 0 ? 'text-success' : r.change < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {r.change > 0 ? `+${r.change}` : r.change}
                    </td>
                    <td className="py-2.5 text-right font-display text-base font-semibold tabular">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

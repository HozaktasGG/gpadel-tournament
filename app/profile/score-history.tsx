'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type Row = {
  id: string
  score: number
  change: number
  reason: string | null
  created_at: string
}

function formatDate(d: string) {
  const date = new Date(d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(d: string) {
  const date = new Date(d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ScoreHistory({ userId }: { userId: string }) {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase
        .from('score_history')
        .select('id, score, change, reason, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (error) {
        setError(error.message)
        setRows([])
        return
      }
      setRows((data ?? []) as Row[])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  if (rows == null) {
    return (
      <section
        className="mt-6 rounded-2xl p-6"
        style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className="text-sm text-white/60">Loading score history...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className="mt-6 rounded-2xl p-6"
        style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h2 className="text-lg font-bold text-white mb-2">Score History</h2>
        <p className="text-sm text-white/60">Could not load score history.</p>
      </section>
    )
  }

  if (rows.length === 0) {
    return (
      <section
        className="mt-6 rounded-2xl p-6"
        style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h2 className="text-lg font-bold text-white mb-2">Score History</h2>
        <p className="text-sm text-white/60">No score events yet. Take the quiz or join a tournament to start tracking your skill points.</p>
      </section>
    )
  }

  const chartData = rows.map(r => ({
    date: formatShortDate(r.created_at),
    fullDate: formatDate(r.created_at),
    score: r.score,
    change: r.change,
    reason: r.reason ?? '—',
  }))

  return (
    <section
      className="mt-6 rounded-2xl p-6"
      style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <h2 className="text-lg font-bold text-white mb-4">Score History</h2>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
              width={42}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f2a1f',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              formatter={(value: any, _name: any, props: any) => {
                const change = props?.payload?.change as number
                const changeLabel = change > 0 ? `+${change}` : String(change)
                return [`${value} pts (${changeLabel})`, props?.payload?.reason ?? '—']
              }}
              labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullDate ?? label}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#ff6b35"
              strokeWidth={2.5}
              dot={{ fill: '#ff6b35', r: 4 }}
              activeDot={{ r: 6, fill: '#ff6b35', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Date', 'Reason', 'Change', 'Total'].map(h => (
                <th
                  key={h}
                  className="text-left text-xs font-semibold text-white/40 uppercase tracking-wide pb-2 pr-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map(r => {
              const isPos = r.change > 0
              const isNeg = r.change < 0
              const changeColor = isPos ? '#4ade80' : isNeg ? '#f87171' : 'rgba(255,255,255,0.7)'
              const changeLabel = isPos ? `+${r.change}` : String(r.change)
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="py-2.5 pr-4 text-white/70 whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="py-2.5 pr-4 text-white/80">{r.reason ?? '—'}</td>
                  <td className="py-2.5 pr-4 font-bold tabular-nums" style={{ color: changeColor }}>
                    {changeLabel}
                  </td>
                  <td className="py-2.5 pr-4 text-white tabular-nums font-semibold">{r.score}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

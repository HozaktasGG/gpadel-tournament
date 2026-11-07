import { americanoSchedule, totalMinutes, type AmericanoFormat, type ScheduleSlot } from '@/lib/americano-format'

type Props = {
  format: AmericanoFormat
  startTime?: string | null
}

export default function AmericanoSchedule({ format, startTime }: Props) {
  return <ScheduleCard slots={americanoSchedule(format, startTime)} summary={`${totalMinutes(format)} min total`} />
}

// Time-slot list (Round 1 18:30–18:50 ...). `summary` is shown in the header.
export function ScheduleCard({ slots, summary }: { slots: ScheduleSlot[]; summary: string }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
        <p className="text-sm font-semibold text-white">Schedule</p>
        <span className="text-xs text-white/50 text-right">{summary}</span>
      </div>
      {slots.map(s => (
        <div
          key={s.label}
          className="px-4 py-2.5 flex items-center gap-3 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <span className="text-xs tabular-nums text-white/60 w-[92px] flex-shrink-0">
            {s.start ? `${s.start}–${s.end}` : '—'}
          </span>
          <span
            className="flex-1 text-sm"
            style={{ color: s.kind === 'finals' ? '#ff6b35' : '#fff', fontWeight: s.kind === 'finals' ? 700 : 500 }}
          >
            {s.label}
          </span>
          <span className="text-xs tabular-nums text-white/50">{s.minutes} min</span>
        </div>
      ))}
    </div>
  )
}

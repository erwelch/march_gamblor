import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { calculatePayout, formatOdds } from '../lib/odds'
import type { BetWithGame } from '../lib/types'
import { marketLabel, resultBadge } from '../lib/bets'

function statusBadge(bet: BetWithGame) {
  if (bet.result !== null) {
    const { label, className } = resultBadge(bet.result)
    return <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>{label}</span>
  }
  if (bet.games.status === 'live') return <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">Live</span>
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">Pending</span>
}

function LineEditor({ bet, onSaved }: { bet: BetWithGame; onSaved: (line: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(bet.line_at_place?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function save() {
    const parsed = parseFloat(value)
    if (isNaN(parsed)) { setEditing(false); return }
    setSaving(true)
    const res = await apiFetch(`/api/bets/${bet.id}/line`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_at_place: parsed }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved(parsed)
      setEditing(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          step="0.5"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={saving}
          className="w-16 rounded bg-gray-700 px-1 py-0.5 text-center text-xs text-gray-100 outline-none ring-1 ring-indigo-500"
        />
        <button onClick={save} disabled={saving} className="text-indigo-400 hover:text-indigo-300 text-xs">✓</button>
        <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
      </span>
    )
  }

  return (
    <span
      className="cursor-pointer text-gray-400 hover:text-gray-200 text-xs"
      title="Click to edit line"
      onClick={() => setEditing(true)}
    >
      {bet.line_at_place != null ? (bet.line_at_place >= 0 ? `+${bet.line_at_place}` : `${bet.line_at_place}`) : <span className="text-orange-400">missing — click to set</span>}
      {' '}<span className="text-gray-600">✎</span>
    </span>
  )
}

export default function BetsPage() {
  const [bets, setBets] = useState<BetWithGame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/bets')
      .then(res => res.ok ? res.json() : { bets: [] })
      .then(data => setBets(data.bets ?? []))
      .finally(() => setLoading(false))
  }, [])

  function updateLine(betId: string, line: number) {
    setBets(prev => prev.map(b => b.id === betId ? { ...b, line_at_place: line } : b))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        Loading bets…
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-100">My Bets</h2>

      {bets.length === 0 ? (
        <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-500">
          No bets placed yet. Head to Games to place your first bet!
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-gray-900 ring-1 ring-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
                <th className="px-4 py-3">Matchup</th>
                <th className="px-4 py-3">Pick</th>
                <th className="px-4 py-3 text-right">Odds</th>
                <th className="px-4 py-3 text-right">Stake</th>
                <th className="px-4 py-3 text-right">Line</th>
                <th className="px-4 py-3 text-right">Potential</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {bets.map(bet => (
                <tr key={bet.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="px-4 py-3 text-gray-300">
                    <div>{bet.games.away_team}</div>
                    <div className="text-xs text-gray-500">@ {bet.games.home_team}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-200">
                    {marketLabel(bet.market, bet.pick, bet.games)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {formatOdds(bet.odds_at_place)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {bet.amount.toLocaleString()} cr
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(bet.market === 'spreads' || bet.market === 'totals')
                      ? <LineEditor bet={bet} onSaved={line => updateLine(bet.id, line)} />
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-green-400">
                    {calculatePayout(bet.amount, bet.odds_at_place).toLocaleString()} cr
                  </td>
                  <td className="px-4 py-3 text-right">
                    {statusBadge(bet)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

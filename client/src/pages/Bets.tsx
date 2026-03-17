import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { calculatePayout, formatOdds } from '../lib/odds'

type BetWithGame = {
  id: string
  game_id: string
  market: 'h2h' | 'spreads' | 'totals'
  pick: 'home' | 'away' | 'over' | 'under'
  amount: number
  odds_at_place: number
  result: 'pending' | 'won' | 'lost' | null
  created_at: string
  games: {
    home_team: string
    away_team: string
    status: 'scheduled' | 'live' | 'final'
    home_score: number | null
    away_score: number | null
  }
}

function marketLabel(market: BetWithGame['market'], pick: BetWithGame['pick'], game: BetWithGame['games']) {
  if (market === 'h2h') return pick === 'home' ? game.home_team : game.away_team
  if (market === 'spreads') return `${pick === 'home' ? game.home_team : game.away_team} (spread)`
  return pick === 'over' ? 'Over' : 'Under'
}

function statusBadge(bet: BetWithGame) {
  if (bet.result === 'won') return <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">Won</span>
  if (bet.result === 'lost') return <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">Lost</span>
  if (bet.games.status === 'live') return <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">Live</span>
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">Pending</span>
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

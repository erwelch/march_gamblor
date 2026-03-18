import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import type { GameWithOdds } from '../lib/types'
import GameCard from '../components/GameCard'

const SYNC_DELAY_MS = 8_000 // re-fetch after background sync likely finishes

export default function DashboardPage() {
  const [games, setGames] = useState<GameWithOdds[]>([])
  const [bettedKeys, setBettedKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadGames = useCallback(async () => {
    const res = await apiFetch('/api/games')
    if (res.ok) {
      const data = await res.json()
      setGames(data.games ?? [])
      setBettedKeys(data.bettedKeys ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadGames()
    // After the server's background sync finishes, quietly refresh to pick up new odds
    const timer = setTimeout(loadGames, SYNC_DELAY_MS)
    return () => clearTimeout(timer)
  }, [loadGames])

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-100">Upcoming &amp; Live Games</h2>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-800" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-500">
          No games available right now. Odds sync every 30 minutes during the tournament.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map(game => (
            <GameCard
              key={game.id}
              game={game}
              bettedKeys={bettedKeys}
              onBetPlaced={loadGames}
            />
          ))}
        </div>
      )}
    </div>
  )
}

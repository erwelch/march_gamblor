import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import type { GameWithOdds } from '../lib/types'
import GameCard from '../components/GameCard'

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
  }, [loadGames])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        Loading games…
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-100">Upcoming &amp; Live Games</h2>

      {games.length === 0 ? (
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

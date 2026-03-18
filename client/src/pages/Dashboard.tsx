import { useEffect, useState, useCallback, useRef } from 'react'
import { apiFetch } from '../lib/api'
import type { GameWithOdds } from '../lib/types'
import GameCard from '../components/GameCard'
import { useSSE } from '../lib/useSSE'

export default function DashboardPage() {
  const [games, setGames] = useState<GameWithOdds[]>([])
  const [bettedKeys, setBettedKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadGames = useCallback(async () => {
    const res = await apiFetch('/api/games')
    if (res.ok) {
      const data = await res.json()
      const incoming: GameWithOdds[] = data.games ?? []
      setGames(prev => {
        const prevMap = new Map(prev.map(g => [g.id, g]))
        let changed = incoming.length !== prev.length
        const next = incoming.map(g => {
          const old = prevMap.get(g.id)
          if (!old) { changed = true; return g }
          const same =
            old.home_score === g.home_score &&
            old.away_score === g.away_score &&
            old.status === g.status &&
            old.odds?.home_ml === g.odds?.home_ml &&
            old.odds?.away_ml === g.odds?.away_ml &&
            old.odds?.home_spread === g.odds?.home_spread &&
            old.odds?.over_under === g.odds?.over_under &&
            old.odds?.fetched_at === g.odds?.fetched_at
          if (!same) changed = true
          return same ? old : g
        })
        return changed ? next : prev
      })
      setBettedKeys(data.bettedKeys ?? [])
    }
    setLoading(false)
  }, [])

  const debouncedLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadGames(), 300)
  }, [loadGames])

  useEffect(() => {
    loadGames()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [loadGames])

  useSSE({
    'scores-updated': debouncedLoad,
    'odds-updated': debouncedLoad,
  })

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

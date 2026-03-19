import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { apiFetch } from '../lib/api'
import type { GameWithOdds } from '../lib/types'
import GameCard from '../components/GameCard'
import { useSSE } from '../lib/useSSE'

export default function DashboardPage() {
  const [games, setGames] = useState<GameWithOdds[]>([])
  const [bettedKeys, setBettedKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [openDateDropdown, setOpenDateDropdown] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState<('scheduled' | 'live' | 'final')[]>(['live', 'scheduled'])
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false)
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

  // Extract unique dates from games
  const uniqueDates = useMemo(() => {
    const dates = [...new Set(games.map(g => g.game_date))].sort()
    return dates
  }, [games])

  // Filter games based on selected dates and statuses
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      const dateMatch = selectedDates.length === 0 || selectedDates.includes(game.game_date)
      const statusMatch = selectedStatuses.includes(game.status)
      return dateMatch && statusMatch
    })
  }, [games, selectedDates, selectedStatuses])

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-100">Upcoming &amp; Live Games</h2>

      {/* Filters */}
      {games.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {/* Date Filter Dropdown */}
          {uniqueDates.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setOpenDateDropdown(!openDateDropdown)}
                className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
              >
                <span>Dates {selectedDates.length > 0 && `(${selectedDates.length})`}</span>
                <svg className={`h-4 w-4 transition-transform ${openDateDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              {openDateDropdown && (
                <div className="absolute top-full left-0 z-10 mt-1 w-48 rounded-lg bg-gray-800 ring-1 ring-gray-700">
                  <div className="p-2">
                    {uniqueDates.map(date => {
                      const [y, m, d] = date.split('-').map(Number)
                      const dateObj = new Date(y, m - 1, d)
                      const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
                      const isSelected = selectedDates.includes(date)
                      return (
                        <label key={date} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-700">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => setSelectedDates(prev =>
                              isSelected ? prev.filter(d => d !== date) : [...prev, date]
                            )}
                            className="h-4 w-4 rounded border-gray-600 bg-gray-700 accent-blue-600"
                          />
                          <span className="text-sm text-gray-300">{label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
              className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
            >
              <span>Status {selectedStatuses.length < 3 && `(${selectedStatuses.length})`}</span>
              <svg className={`h-4 w-4 transition-transform ${openStatusDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
            {openStatusDropdown && (
              <div className="absolute top-full left-0 z-10 mt-1 w-40 rounded-lg bg-gray-800 ring-1 ring-gray-700">
                <div className="p-2">
                  {(['scheduled', 'live', 'final'] as const).map(status => {
                    const isSelected = selectedStatuses.includes(status)
                    return (
                      <label key={status} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-700">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => setSelectedStatuses(prev =>
                            isSelected ? prev.filter(s => s !== status) : [...prev, status]
                          )}
                          className="h-4 w-4 rounded border-gray-600 bg-gray-700 accent-blue-600"
                        />
                        <span className="text-sm text-gray-300 capitalize">{status}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Clear Filters */}
          {(selectedDates.length > 0 || selectedStatuses.length < 3) && (
            <button
              onClick={() => {
                setSelectedDates([])
                setSelectedStatuses(['live', 'scheduled'])
              }}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

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
      ) : filteredGames.length === 0 ? (
        <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-500">
          No games match your filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map(game => (
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

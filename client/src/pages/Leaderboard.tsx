import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { ProfileRow, BetWithGame } from '../lib/types'
import { marketLabel, resultBadge } from '../lib/bets'
import { formatOdds } from '../lib/odds'

export default function LeaderboardPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [userBets, setUserBets] = useState<Record<string, BetWithGame[]>>({})
  const [loadingBetsFor, setLoadingBetsFor] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: { user } }, res] = await Promise.all([
        supabase.auth.getUser(),
        apiFetch('/api/leaderboard'),
      ])
      setCurrentUserId(user?.id ?? null)
      if (res.ok) {
        const data = await res.json()
        setProfiles(data.profiles ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function toggleUser(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null)
      return
    }
    setExpandedUserId(userId)
    if (userBets[userId] !== undefined) return
    setLoadingBetsFor(userId)
    try {
      const res = await apiFetch(`/api/leaderboard/${userId}/bets`)
      if (res.ok) {
        const data = await res.json()
        setUserBets(prev => ({ ...prev, [userId]: data.bets ?? [] }))
      } else {
        setUserBets(prev => ({ ...prev, [userId]: [] }))
      }
    } finally {
      setLoadingBetsFor(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        Loading leaderboard…
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-100">Leaderboard</h2>

      <div className="overflow-hidden rounded-xl bg-gray-900 ring-1 ring-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-right">+/- vs Start</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p, i) => {
              const isMe = p.id === currentUserId
              const delta = p.balance - 1000
              const isExpanded = expandedUserId === p.id
              const bets = userBets[p.id]
              const isLoadingBets = loadingBetsFor === p.id

              return (
                <React.Fragment key={p.id}>
                  <tr
                    onClick={() => toggleUser(p.id)}
                    className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-gray-800/40 ${isMe ? 'bg-orange-500/5' : ''} ${isExpanded ? 'border-gray-800' : 'last:border-0'}`}
                  >
                    <td className="px-4 py-3 font-mono text-gray-500">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-200">
                      <span className="flex items-center gap-2">
                        <svg
                          className={`h-3 w-3 shrink-0 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        {p.username}
                        {isMe && <span className="text-xs text-orange-400">(you)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-100">
                      {p.balance.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {delta >= 0 ? '+' : ''}{delta.toLocaleString()}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="border-b border-gray-800/50 last:border-0 bg-gray-950/60">
                      <td colSpan={4} className="px-4 py-4">
                        {isLoadingBets ? (
                          <div className="py-4 text-center text-xs text-gray-500">Loading bets…</div>
                        ) : !bets || bets.length === 0 ? (
                          <div className="py-4 text-center text-xs text-gray-500">No settled bets yet</div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-600">
                                <th className="pb-2 pr-4">Matchup</th>
                                <th className="pb-2 pr-4">Pick</th>
                                <th className="pb-2 pr-4 text-right">Odds</th>
                                <th className="pb-2 pr-4 text-right">Stake</th>
                                <th className="pb-2 text-right">Result</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bets.map(bet => {
                                const { label, className } = resultBadge(bet.result)
                                return (
                                  <tr key={bet.id} className="border-t border-gray-800/40">
                                    <td className="py-2 pr-4 text-gray-400">
                                      <div>{bet.games.away_team}</div>
                                      <div className="text-gray-600">@ {bet.games.home_team}</div>
                                      {bet.games.home_score !== null && (
                                        <div className="text-gray-600">
                                          {bet.games.away_score}–{bet.games.home_score}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2 pr-4 text-gray-300">
                                      {marketLabel(bet.market, bet.pick, bet.games)}
                                    </td>
                                    <td className="py-2 pr-4 text-right text-gray-400">
                                      {formatOdds(bet.odds_at_place)}
                                    </td>
                                    <td className="py-2 pr-4 text-right text-gray-400">
                                      {bet.amount.toLocaleString()} cr
                                    </td>
                                    <td className="py-2 text-right">
                                      <span className={`rounded-full px-2 py-0.5 ${className}`}>{label}</span>
                                      {bet.result === 'win' && bet.payout !== null && (
                                        <div className="mt-0.5 text-green-400">+{bet.payout.toLocaleString()} cr</div>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

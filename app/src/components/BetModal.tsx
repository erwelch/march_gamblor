'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GameWithOdds } from '@/lib/supabase/types'
import { formatOdds, calculatePayout } from '@/lib/odds'

interface BetModalProps {
  game: GameWithOdds
  market: 'h2h' | 'spreads' | 'totals'
  pick: 'home' | 'away' | 'over' | 'under'
  odds: number
  onClose: () => void
}

const MARKET_LABELS = { h2h: 'Moneyline', spreads: 'Spread', totals: 'Total' }

export default function BetModal({ game, market, pick, odds, onClose }: BetModalProps) {
  const router = useRouter()
  const [amount, setAmount] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const pickLabel = pick === 'home' ? game.home_team
    : pick === 'away' ? game.away_team
    : pick.charAt(0).toUpperCase() + pick.slice(1)

  const potentialPayout = calculatePayout(amount, odds)

  async function handlePlace() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: game.id, market, pick, amount }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to place bet')
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => {
        onClose()
        router.refresh()
      }, 1200)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-xl bg-gray-900 p-6 ring-1 ring-gray-700">
        {success ? (
          <div className="py-4 text-center">
            <div className="mb-2 text-4xl">✅</div>
            <p className="font-semibold text-green-400">Bet placed!</p>
            <p className="mt-1 text-sm text-gray-400">Potential payout: {potentialPayout.toLocaleString()} cr</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">{MARKET_LABELS[market]}</p>
                <p className="font-semibold text-white">
                  {pickLabel} <span className="text-orange-400">{formatOdds(odds)}</span>
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {game.away_team} @ {game.home_team}
                </p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-300 ring-1 ring-red-700">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-sm text-gray-400">Wager (credits)</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={amount}
                onChange={e => setAmount(Math.max(1, Math.floor(Number(e.target.value))))}
                className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white ring-1 ring-gray-700 focus:outline-none focus:ring-orange-500"
              />
              <div className="mt-2 flex gap-2">
                {[50, 100, 250, 500].map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className="flex-1 rounded bg-gray-800 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-sm">
              <span className="text-gray-400">Potential payout</span>
              <span className="font-semibold text-green-400">{potentialPayout.toLocaleString()} cr</span>
            </div>

            <button
              onClick={handlePlace}
              disabled={loading || amount < 1}
              className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
            >
              {loading ? 'Placing…' : `Place ${amount.toLocaleString()} cr Bet`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

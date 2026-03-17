import { useState } from 'react'
import { format } from 'date-fns'
import type { GameWithOdds } from '../lib/types'
import { formatOdds, formatSpread } from '../lib/odds'
import BetModal from './BetModal'

interface GameCardProps {
  game: GameWithOdds
  bettedKeys: string[]
  onBetPlaced: () => void
}

const STATUS_BADGE: Record<string, string> = {
  live: 'bg-red-500/20 text-red-400 ring-red-500/30',
  scheduled: 'bg-gray-700/50 text-gray-400 ring-gray-600/30',
  final: 'bg-gray-700/50 text-gray-500 ring-gray-600/30',
}

export default function GameCard({ game, bettedKeys, onBetPlaced }: GameCardProps) {
  const [betModal, setBetModal] = useState<{ market: 'h2h' | 'spreads' | 'totals'; pick: 'home' | 'away' | 'over' | 'under'; odds: number } | null>(null)
  const bettedSet = new Set(bettedKeys)
  const hasExistingBet = (market: string) => bettedSet.has(`${game.id}:${market}`)
  const o = game.odds

  const isLocked = game.status !== 'scheduled' || new Date(game.start_time) <= new Date()

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl bg-gray-900 p-4 ring-1 ring-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_BADGE[game.status]}`}>
            {game.status === 'live' ? 'LIVE' : game.status === 'final' ? 'FINAL' : format(new Date(game.start_time), 'EEE h:mm a')}
          </span>
          {game.network && <span className="text-xs text-gray-600">{game.network}</span>}
        </div>

        {/* Teams & Score */}
        <div className="space-y-1">
          <TeamRow
            name={game.away_team}
            score={game.away_score}
            isFinal={game.status === 'final'}
            won={game.status === 'final' && (game.away_score ?? 0) > (game.home_score ?? 0)}
          />
          <TeamRow
            name={game.home_team}
            score={game.home_score}
            isFinal={game.status === 'final'}
            won={game.status === 'final' && (game.home_score ?? 0) > (game.away_score ?? 0)}
          />
        </div>

        {/* Odds Buttons */}
        {o && !isLocked && (
          <div className="space-y-2">
            {/* Moneyline */}
            <div>
              <p className="mb-1 text-xs text-gray-600">Moneyline</p>
              <div className="grid grid-cols-2 gap-1.5">
                <OddsButton
                  label={game.away_team}
                  value={formatOdds(o.away_ml)}
                  hasExisting={hasExistingBet('h2h')}
                  onClick={() => setBetModal({ market: 'h2h', pick: 'away', odds: o.away_ml! })}
                />
                <OddsButton
                  label={game.home_team}
                  value={formatOdds(o.home_ml)}
                  hasExisting={hasExistingBet('h2h')}
                  onClick={() => setBetModal({ market: 'h2h', pick: 'home', odds: o.home_ml! })}
                />
              </div>
            </div>

            {/* Spread */}
            {o.home_spread !== null && (
              <div>
                <p className="mb-1 text-xs text-gray-600">Spread</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <OddsButton
                    label={`${game.away_team} ${formatSpread(o.home_spread === null ? null : -o.home_spread!)}`}
                    value={formatOdds(o.away_spread_price)}
                    hasExisting={hasExistingBet('spreads')}
                    onClick={() => setBetModal({ market: 'spreads', pick: 'away', odds: o.away_spread_price! })}
                  />
                  <OddsButton
                    label={`${game.home_team} ${formatSpread(o.home_spread)}`}
                    value={formatOdds(o.home_spread_price)}
                    hasExisting={hasExistingBet('spreads')}
                    onClick={() => setBetModal({ market: 'spreads', pick: 'home', odds: o.home_spread_price! })}
                  />
                </div>
              </div>
            )}

            {/* Total */}
            {o.over_under !== null && (
              <div>
                <p className="mb-1 text-xs text-gray-600">Total {o.over_under}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <OddsButton
                    label="Over"
                    value={formatOdds(o.over_price)}
                    hasExisting={hasExistingBet('totals')}
                    onClick={() => setBetModal({ market: 'totals', pick: 'over', odds: o.over_price! })}
                  />
                  <OddsButton
                    label="Under"
                    value={formatOdds(o.under_price)}
                    hasExisting={hasExistingBet('totals')}
                    onClick={() => setBetModal({ market: 'totals', pick: 'under', odds: o.under_price! })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isLocked && game.status !== 'final' && (
          <p className="text-center text-xs text-gray-600">Betting locked</p>
        )}
      </div>

      {betModal && (
        <BetModal
          game={game}
          market={betModal.market}
          pick={betModal.pick}
          odds={betModal.odds}
          onClose={() => setBetModal(null)}
          onBetPlaced={onBetPlaced}
        />
      )}
    </>
  )
}

function TeamRow({ name, score, isFinal, won }: { name: string; score: number | null; isFinal: boolean; won: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm font-medium ${won ? 'text-white' : 'text-gray-300'}`}>{name}</span>
      {isFinal && score !== null && (
        <span className={`text-sm font-bold ${won ? 'text-white' : 'text-gray-500'}`}>{score}</span>
      )}
    </div>
  )
}

function OddsButton({ label, value, hasExisting, onClick }: {
  label: string
  value: string
  hasExisting: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={hasExisting}
      className="flex flex-col items-center rounded-lg bg-gray-800 px-2 py-1.5 text-xs ring-1 ring-gray-700 transition-colors hover:bg-gray-700 hover:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="truncate text-gray-400">{label}</span>
      <span className="font-semibold text-orange-400">{value}</span>
    </button>
  )
}

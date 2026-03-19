import { memo, useState } from 'react'
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

function GameCard({ game, bettedKeys, onBetPlaced }: GameCardProps) {
  const [betModal, setBetModal] = useState<{ market: 'h2h' | 'spreads' | 'totals'; pick: 'home' | 'away' | 'over' | 'under'; odds: number } | null>(null)
  const bettedSet = new Set(bettedKeys)
  const hasExistingBet = (market: string) => bettedSet.has(`${game.id}:${market}`)
  const o = game.odds

  const isLive = game.status === 'live'
  const isFinal = game.status === 'final'
  const isLocked = isLive || isFinal || (!o && new Date(game.start_time) <= new Date())
  const showOdds = !!o && (isLive || isFinal || !isLocked)

  return (
    <>
      <div className={`relative flex flex-col gap-3 rounded-xl bg-gray-900 p-4 ring-1 ${isLive ? 'ring-red-500/40' : isFinal ? 'ring-gray-700/60 opacity-60' : 'ring-gray-800'}`}>
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
            isLive={isLive}
            isFinal={isFinal}
            won={isFinal && (game.away_score ?? 0) > (game.home_score ?? 0)}
          />
          <TeamRow
            name={game.home_team}
            score={game.home_score}
            isLive={isLive}
            isFinal={isFinal}
            won={isFinal && (game.home_score ?? 0) > (game.away_score ?? 0)}
          />
        </div>

        {/* Odds Buttons */}
        {showOdds && (
          <div className="space-y-2">
            {/* Moneyline */}
            <div>
              <p className="mb-1 text-xs text-gray-600">Moneyline</p>
              <div className="grid grid-cols-2 gap-1.5">
                <OddsButton
                  label={game.away_team}
                  value={formatOdds(o.away_ml)}
                  hasExisting={hasExistingBet('h2h')}
                  disabled={isLive || isFinal}
                  onClick={() => setBetModal({ market: 'h2h', pick: 'away', odds: o.away_ml! })}
                />
                <OddsButton
                  label={game.home_team}
                  value={formatOdds(o.home_ml)}
                  hasExisting={hasExistingBet('h2h')}
                  disabled={isLive || isFinal}
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
                    disabled={isLive || isFinal}
                    onClick={() => setBetModal({ market: 'spreads', pick: 'away', odds: o.away_spread_price! })}
                  />
                  <OddsButton
                    label={`${game.home_team} ${formatSpread(o.home_spread)}`}
                    value={formatOdds(o.home_spread_price)}
                    hasExisting={hasExistingBet('spreads')}
                    disabled={isLive || isFinal}
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
                    disabled={isLive || isFinal}
                    onClick={() => setBetModal({ market: 'totals', pick: 'over', odds: o.over_price! })}
                  />
                  <OddsButton
                    label="Under"
                    value={formatOdds(o.under_price)}
                    hasExisting={hasExistingBet('totals')}
                    disabled={isLive || isFinal}
                    onClick={() => setBetModal({ market: 'totals', pick: 'under', odds: o.under_price! })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isLive && (
          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 py-1.5 ring-1 ring-red-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <p className="text-xs font-medium text-red-400">Game in progress — betting closed</p>
          </div>
        )}
        {isFinal && (
          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-700/40 py-1.5 ring-1 ring-gray-600/30">
            <p className="text-xs font-medium text-gray-500">Game over — betting closed</p>
          </div>
        )}
        {isLocked && !isLive && !isFinal && (
          <p className="text-center text-xs text-gray-600">Betting locked</p>
        )}

        {o?.fetched_at && (
          <p className="text-right text-xs text-gray-600">
            Odds updated {format(new Date(o.fetched_at), 'h:mm a')}
          </p>
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

export default memo(GameCard)

function TeamRow({ name, score, isLive, isFinal, won }: { name: string; score: number | null; isLive: boolean; isFinal: boolean; won: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm font-medium ${won ? 'text-white' : 'text-gray-300'}`}>{name}</span>
      {isLive && score !== null && (
        <span className="text-sm font-bold text-red-400">{score}</span>
      )}
      {isFinal && score !== null && (
        <span className={`text-sm font-bold ${won ? 'text-white' : 'text-gray-500'}`}>{score}</span>
      )}
    </div>
  )
}

function OddsButton({ label, value, hasExisting, disabled, onClick }: {
  label: string
  value: string
  hasExisting: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const isDisabled = hasExisting || disabled
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className="flex flex-col items-center rounded-lg bg-gray-800 px-2 py-1.5 text-xs ring-1 ring-gray-700 transition-colors hover:bg-gray-700 hover:ring-orange-500 hover:scale-[1.03] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="text-gray-400 break-words">{label}</span>
      <span className="font-semibold text-orange-400">{value}</span>
    </button>
  )
}

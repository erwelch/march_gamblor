import type { BetWithGame } from './types'

export function marketLabel(
  market: BetWithGame['market'],
  pick: BetWithGame['pick'],
  game: BetWithGame['games'],
) {
  if (market === 'h2h') return pick === 'home' ? game.home_team : game.away_team
  if (market === 'spreads') return `${pick === 'home' ? game.home_team : game.away_team} (spread)`
  return pick === 'over' ? 'Over' : 'Under'
}

export function resultBadge(result: BetWithGame['result']): {
  label: string
  className: string
} {
  if (result === 'win') return { label: 'Won', className: 'bg-green-500/20 text-green-400' }
  if (result === 'loss') return { label: 'Lost', className: 'bg-red-500/20 text-red-400' }
  if (result === 'push') return { label: 'Push', className: 'bg-blue-500/20 text-blue-400' }
  return { label: 'Pending', className: 'bg-gray-700 text-gray-400' }
}

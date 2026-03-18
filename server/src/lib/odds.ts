export function americanToDecimal(american: number): number {
  if (american >= 0) return 1 + american / 100
  return 1 + 100 / Math.abs(american)
}

export function calculatePayout(stake: number, americanOdds: number): number {
  return Math.round(stake * americanToDecimal(americanOdds))
}

export function formatOdds(odds: number | null | undefined): string {
  if (odds == null) return 'N/A'
  return odds >= 0 ? `+${odds}` : `${odds}`
}

export function formatSpread(spread: number | null | undefined): string {
  if (spread == null) return 'N/A'
  return spread >= 0 ? `+${spread}` : `${spread}`
}

// odds keyed by oddID as returned by the SportsGameOdds SDK (event.odds)
type ByBookmakerEntry = {
  odds?: string | null
  spread?: string | null
  overUnder?: string | null
  available?: boolean
}
type OddEntry = {
  bookOdds?: string | null
  bookSpread?: string | null
  bookOverUnder?: string | null
  byBookmaker?: Record<string, ByBookmakerEntry>
}
type EventOddsMap = Record<string, OddEntry>

function parseNum(val: string | null | undefined): number | null {
  if (val == null || val === '') return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function getOdds(entry: OddEntry | undefined, bookmakerID: string, field: 'odds' | 'spread' | 'overUnder'): string | null | undefined {
  const bk = entry?.byBookmaker?.[bookmakerID]
  if (bk?.available !== false && bk?.[field] != null) return bk[field]
  // fall back to consensus
  if (field === 'odds') return entry?.bookOdds
  if (field === 'spread') return entry?.bookSpread
  if (field === 'overUnder') return entry?.bookOverUnder
  return null
}

export function parseEventOdds(eventOdds: EventOddsMap, bookmakerID: string) {
  if (!eventOdds) return null

  const homeML = eventOdds['points-home-game-ml-home']
  const awayML = eventOdds['points-away-game-ml-away']
  const homeSP = eventOdds['points-home-game-sp-home']
  const awaySP = eventOdds['points-away-game-sp-away']
  const over   = eventOdds['points-all-game-ou-over']
  const under  = eventOdds['points-all-game-ou-under']

  const home_ml            = parseNum(getOdds(homeML, bookmakerID, 'odds'))
  const away_ml            = parseNum(getOdds(awayML, bookmakerID, 'odds'))
  const home_spread        = parseNum(getOdds(homeSP, bookmakerID, 'spread'))
  const home_spread_price  = parseNum(getOdds(homeSP, bookmakerID, 'odds'))
  const away_spread_price  = parseNum(getOdds(awaySP, bookmakerID, 'odds'))
  const over_under         = parseNum(getOdds(over,   bookmakerID, 'overUnder'))
  const over_price         = parseNum(getOdds(over,   bookmakerID, 'odds'))
  const under_price        = parseNum(getOdds(under,  bookmakerID, 'odds'))

  return {
    bookmaker: bookmakerID,
    home_ml, away_ml,
    home_spread, home_spread_price, away_spread_price,
    over_under, over_price, under_price,
  }
}
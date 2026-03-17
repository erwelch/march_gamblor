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

export interface OddsApiEvent {
  id: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Array<{
    key: string
    last_update: string
    markets: Array<{
      key: string
      outcomes: Array<{ name: string; price: number; point?: number }>
    }>
  }>
}

export function parseOddsApiEvent(event: OddsApiEvent) {
  const bookmaker = event.bookmakers[0]
  if (!bookmaker) return null

  let home_ml: number | null = null
  let away_ml: number | null = null
  let home_spread: number | null = null
  let home_spread_price: number | null = null
  let away_spread_price: number | null = null
  let over_under: number | null = null
  let over_price: number | null = null
  let under_price: number | null = null

  for (const market of bookmaker.markets) {
    if (market.key === 'h2h') {
      const home = market.outcomes.find(o => o.name === event.home_team)
      const away = market.outcomes.find(o => o.name === event.away_team)
      home_ml = home?.price ?? null
      away_ml = away?.price ?? null
    } else if (market.key === 'spreads') {
      const home = market.outcomes.find(o => o.name === event.home_team)
      const away = market.outcomes.find(o => o.name === event.away_team)
      home_spread = home?.point ?? null
      home_spread_price = home?.price ?? null
      away_spread_price = away?.price ?? null
    } else if (market.key === 'totals') {
      const over = market.outcomes.find(o => o.name === 'Over')
      const under = market.outcomes.find(o => o.name === 'Under')
      over_under = over?.point ?? null
      over_price = over?.price ?? null
      under_price = under?.price ?? null
    }
  }

  return {
    bookmaker: bookmaker.key,
    home_ml, away_ml,
    home_spread, home_spread_price, away_spread_price,
    over_under, over_price, under_price,
  }
}
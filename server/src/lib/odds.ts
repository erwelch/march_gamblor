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

export function parseEventOdds(eventOdds: any, bookmakerName: string) {
  // eventOdds is HistoricalEventOdds: { id, home, away, date, bookmakers: Record<string, Array<{name, odds[]}>> }
  const bookmakerMarkets: Array<{ name: string; odds: any[] }> =
    eventOdds?.bookmakers?.[bookmakerName]
  if (!bookmakerMarkets || bookmakerMarkets.length === 0) return null

  let home_ml: number | null = null
  let away_ml: number | null = null
  let home_spread: number | null = null
  let home_spread_price: number | null = null
  let away_spread_price: number | null = null
  let over_under: number | null = null
  let over_price: number | null = null
  let under_price: number | null = null

  for (const market of bookmakerMarkets) {
    if (market.name === 'ML') {
      const line = market.odds?.[0]
      if (line) {
        home_ml = line.home != null ? parseFloat(line.home) : null
        away_ml = line.away != null ? parseFloat(line.away) : null
      }
    } else if (market.name === 'Spread') {
      // Pick the main line: the hdp entry whose absolute value is smallest
      const lines: Array<{ hdp: number; home: string; away: string }> = market.odds ?? []
      if (lines.length > 0) {
        const main = lines.reduce((best, cur) =>
          Math.abs(cur.hdp) < Math.abs(best.hdp) ? cur : best
        )
        home_spread = main.hdp
        home_spread_price = main.home != null ? parseFloat(main.home) : null
        away_spread_price = main.away != null ? parseFloat(main.away) : null
      }
    } else if (market.name === 'Totals') {
      // Pick the most balanced line: hdp where |over - under| is smallest
      const lines: Array<{ hdp: number; over: string; under: string }> = market.odds ?? []
      if (lines.length > 0) {
        const main = lines.reduce((best, cur) => {
          const curDiff = Math.abs(parseFloat(cur.over) - parseFloat(cur.under))
          const bestDiff = Math.abs(parseFloat(best.over) - parseFloat(best.under))
          return curDiff < bestDiff ? cur : best
        })
        over_under = main.hdp
        over_price = main.over != null ? parseFloat(main.over) : null
        under_price = main.under != null ? parseFloat(main.under) : null
      }
    }
  }

  return {
    bookmaker: bookmakerName,
    home_ml, away_ml,
    home_spread, home_spread_price, away_spread_price,
    over_under, over_price, under_price,
  }
}
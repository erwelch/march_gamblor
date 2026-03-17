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

export type GameRow = {
  id: string
  ncaa_game_id: string
  home_team: string
  away_team: string
  start_time: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'final'
  network: string | null
  game_date: string
}

export type OddsRow = {
  id: string
  game_id: string
  bookmaker: string
  home_ml: number | null
  away_ml: number | null
  home_spread: number | null
  home_spread_price: number | null
  away_spread_price: number | null
  over_under: number | null
  over_price: number | null
  under_price: number | null
  fetched_at: string | null
}

export type GameWithOdds = GameRow & { odds: OddsRow | null }

export type ProfileRow = {
  id: string
  username: string
  balance: number
}

export type BetWithGame = {
  id: string
  game_id: string
  market: 'h2h' | 'spreads' | 'totals'
  pick: 'home' | 'away' | 'over' | 'under'
  amount: number
  odds_at_place: number
  line_at_place: number | null
  result: 'win' | 'loss' | 'push' | null
  payout: number | null
  placed_at: string
  games: {
    home_team: string
    away_team: string
    status: 'scheduled' | 'live' | 'final'
    home_score: number | null
    away_score: number | null
  }
}


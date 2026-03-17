export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          balance: number
          created_at: string
        }
        Insert: {
          id: string
          username: string
          balance?: number
          created_at?: string
        }
        Update: {
          username?: string
          balance?: number
        }
        Relationships: []
      }
      games: {
        Row: {
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
          created_at: string
          updated_at: string
        }
        Insert: {
          ncaa_game_id: string
          home_team: string
          away_team: string
          start_time: string
          home_score?: number | null
          away_score?: number | null
          status?: 'scheduled' | 'live' | 'final'
          network?: string | null
          game_date: string
        }
        Update: {
          ncaa_game_id?: string
          home_team?: string
          away_team?: string
          start_time?: string
          home_score?: number | null
          away_score?: number | null
          status?: 'scheduled' | 'live' | 'final'
          network?: string | null
          game_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      odds: {
        Row: {
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
          fetched_at: string
        }
        Insert: {
          game_id: string
          bookmaker: string
          home_ml?: number | null
          away_ml?: number | null
          home_spread?: number | null
          home_spread_price?: number | null
          away_spread_price?: number | null
          over_under?: number | null
          over_price?: number | null
          under_price?: number | null
        }
        Update: {
          game_id?: string
          bookmaker?: string
          home_ml?: number | null
          away_ml?: number | null
          home_spread?: number | null
          home_spread_price?: number | null
          away_spread_price?: number | null
          over_under?: number | null
          over_price?: number | null
          under_price?: number | null
          fetched_at?: string
        }
        Relationships: []
      }
      bets: {
        Row: {
          id: string
          user_id: string
          game_id: string
          market: 'h2h' | 'spreads' | 'totals'
          pick: 'home' | 'away' | 'over' | 'under'
          amount: number
          odds_at_place: number
          result: 'win' | 'loss' | 'push' | null
          payout: number | null
          placed_at: string
          settled_at: string | null
        }
        Insert: {
          user_id: string
          game_id: string
          market: 'h2h' | 'spreads' | 'totals'
          pick: 'home' | 'away' | 'over' | 'under'
          amount: number
          odds_at_place: number
        }
        Update: {
          result?: 'win' | 'loss' | 'push'
          payout?: number
          settled_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Game = Database['public']['Tables']['games']['Row']
export type Odds = Database['public']['Tables']['odds']['Row']
export type Bet = Database['public']['Tables']['bets']['Row']

// Enriched types used in the UI
export type GameWithOdds = Game & { odds: Odds | null }
export type BetWithGame = Bet & { game: Game }

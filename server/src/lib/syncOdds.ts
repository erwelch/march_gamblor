import { createServiceClient } from './supabase'
import { parseOddsApiEvent, type OddsApiEvent } from './odds'

export async function syncOdds(): Promise<{ upserted: number; total: number; error?: string }> {
  const API_KEY = process.env.ODDS_API_KEY
  if (!API_KEY) return { upserted: 0, total: 0, error: 'ODDS_API_KEY not set' }

  const url = `https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds?apiKey=${API_KEY}&bookmakers=draftkings&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`

  const res = await fetch(url)
  if (!res.ok) return { upserted: 0, total: 0, error: `Odds API error: ${res.status}` }

  const events: OddsApiEvent[] = await res.json()
  const supabase = createServiceClient()
  let upserted = 0

  for (const event of events) {
    const { data: game, error: gameError } = await supabase
      .from('games')
      .upsert(
        {
          ncaa_game_id: event.id,
          home_team: event.home_team,
          away_team: event.away_team,
          start_time: event.commence_time,
          game_date: event.commence_time.substring(0, 10),
        },
        { onConflict: 'ncaa_game_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (gameError || !game) continue

    const parsed = parseOddsApiEvent(event)
    if (!parsed) continue

    const { error: oddsError } = await supabase.from('odds').upsert(
      { game_id: game.id, ...parsed },
      { onConflict: 'game_id,bookmaker' }
    )
    if (oddsError) continue

    upserted++
  }

  return { upserted, total: events.length }
}
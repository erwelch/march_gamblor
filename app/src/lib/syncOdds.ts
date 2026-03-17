import { createServiceClient } from '@/lib/supabase/server'
import { parseOddsApiEvent, type OddsApiEvent } from '@/lib/odds'

export async function syncOdds(): Promise<{ upserted: number; total: number; error?: string }> {
  const API_KEY = process.env.ODDS_API_KEY
  console.log('[syncOdds] ODDS_API_KEY present:', !!API_KEY)
  if (!API_KEY) return { upserted: 0, total: 0, error: 'ODDS_API_KEY not set' }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log('[syncOdds] SUPABASE_URL present:', !!SUPABASE_URL)
  console.log('[syncOdds] SERVICE_ROLE_KEY present:', !!SERVICE_KEY && SERVICE_KEY !== 'your-service-role-key')

  const url = `https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds?apiKey=${API_KEY}&bookmakers=draftkings&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`

  console.log('[syncOdds] Fetching odds from API...')
  const res = await fetch(url, { cache: 'no-store' })
  console.log('[syncOdds] Odds API response status:', res.status)
  if (!res.ok) return { upserted: 0, total: 0, error: `Odds API error: ${res.status}` }

  const events: OddsApiEvent[] = await res.json()
  console.log('[syncOdds] Events received:', events.length)

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
          status: 'scheduled',
        },
        { onConflict: 'ncaa_game_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (gameError || !game) {
      console.error('[syncOdds] Game upsert error:', gameError?.message, event.home_team, 'vs', event.away_team)
      continue
    }

    const parsed = parseOddsApiEvent(event)
    if (!parsed) continue

    const { error: oddsError } = await supabase.from('odds').upsert(
      { game_id: game.id, ...parsed },
      { onConflict: 'game_id,bookmaker' }
    )
    if (oddsError) {
      console.error('[syncOdds] Odds upsert error:', oddsError.message)
      continue
    }

    upserted++
  }

  console.log('[syncOdds] Done. upserted:', upserted, '/', events.length)
  return { upserted, total: events.length }
}

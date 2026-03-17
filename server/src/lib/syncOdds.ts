import { createRequire } from 'module'
const { OddsAPIClient } = createRequire(import.meta.url)('odds-api-io')
import { createServiceClient } from './supabase'
import { parseEventOdds } from './odds'

export async function syncOdds() {
  const API_KEY = process.env.ODDS_API_KEY
  if (!API_KEY) return { upserted: 0, total: 0, error: 'ODDS_API_KEY not set' }

  const client = new OddsAPIClient({ apiKey: API_KEY })

  let events
  try {
    events = await client.getEvents({
      sport: 'basketball',
      league: 'usa-ncaa-division-i-national-championship',
      status: 'pending,live',
    })
  } catch (err: any) {
    return { upserted: 0, total: 0, error: `Failed to fetch events: ${err?.message ?? err}` }
  }

  if (!events || events.length === 0) return { upserted: 0, total: 0 }

  const supabase = createServiceClient()
  let upserted = 0

  for (const event of events) {
    const homeTeam = event.home
    const awayTeam = event.away
    const startTime = event.date

    const { data: game, error: gameError } = await supabase
      .from('games')
      .upsert(
        {
          ncaa_game_id: event.id,
          home_team: homeTeam,
          away_team: awayTeam,
          start_time: startTime,
          game_date: startTime.substring(0, 10),
        },
        { onConflict: 'ncaa_game_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (gameError || !game) continue

    let eventOdds
    try {
      eventOdds = await client.getEventOdds({
        eventId: String(event.id),
        bookmakers: 'DraftKings,BetMGM',
        region: 'us',
        oddsFormat: 'american',
        oddTypes: 'h2h,spreads,totals',
      })
    } catch (err: any) {
      console.warn(`[syncOdds] Failed to fetch odds for event ${event.id}:`, err?.message ?? err)
      continue
    }

    if (!eventOdds) continue

    const parsed = parseEventOdds(eventOdds, 'DraftKings')
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
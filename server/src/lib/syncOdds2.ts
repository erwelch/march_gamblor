import { SharpAPI } from '@sharp-api/client'
import { createServiceClient } from './supabase'
import { broadcast } from './broadcaster'

const BOOKMAKER = 'draftkings'

interface ParsedOdds {
  bookmaker: string
  home_ml: number | null
  away_ml: number | null
  home_spread: number | null
  home_spread_price: number | null
  away_spread_price: number | null
  over_under: number | null
  over_price: number | null
  under_price: number | null
}

interface SharpOddsLine {
  market_type: string
  selection_type: string
  odds_american: number
  line: number | null
}

function parseSharpOdds(lines: SharpOddsLine[]): ParsedOdds {
  const result: ParsedOdds = {
    bookmaker: BOOKMAKER,
    home_ml: null,
    away_ml: null,
    home_spread: null,
    home_spread_price: null,
    away_spread_price: null,
    over_under: null,
    over_price: null,
    under_price: null,
  }

  for (const line of lines) {
    const { market_type, selection_type, odds_american, line: spreadLine } = line

    if (market_type === 'moneyline') {
      if (selection_type === 'home') result.home_ml = odds_american
      else if (selection_type === 'away') result.away_ml = odds_american
    } else if (market_type === 'point_spread' || market_type === 'spread') {
      if (selection_type === 'home') {
        result.home_spread = spreadLine ?? null
        result.home_spread_price = odds_american
      } else if (selection_type === 'away') {
        result.away_spread_price = odds_american
      }
    } else if (market_type === 'total_points' || market_type === 'total') {
      if (selection_type === 'over') {
        result.over_under = spreadLine ?? null
        result.over_price = odds_american
      } else if (selection_type === 'under') {
        result.under_price = odds_american
      }
    }
  }

  return result
}

interface EventWithOdds {
  event_id: string
  event_name: string
  start_time: string
  home_team?: string
  away_team?: string
  odds: SharpOddsLine[]
}

async function processPage(
  supabase: ReturnType<typeof createServiceClient>,
  events: EventWithOdds[]
): Promise<{ upserted: number }> {
  let upserted = 0

  for (const event of events) {
    const eventId = event.event_id
    const startTime = event.start_time
    
    // Extract team names from odds lines (they're duplicated across all lines for the same event)
    const firstOdds = event.odds[0]
    const homeTeam = (firstOdds as any)?.home_team || event.home_team
    const awayTeam = (firstOdds as any)?.away_team || event.away_team

    // Skip events with missing required fields
    if (!eventId || !startTime || !homeTeam || !awayTeam) {
      console.warn(`[syncOdds2] Skipping event with missing fields: eventId=${eventId}, startTime=${startTime}, homeTeam=${homeTeam}, awayTeam=${awayTeam}`)
      continue
    }

    console.log(`[syncOdds2] Processing ${awayTeam} @ ${homeTeam}, startsAt=${startTime}`)

    // Compute game_date in US Eastern time (ET = UTC-5 standard, UTC-4 daylight)
    // Use Intl.DateTimeFormat to get the correct local date for the event
    const startDate = new Date(startTime)
    const etDateStr = startDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // en-CA gives YYYY-MM-DD

    const { data: game, error: gameError } = await supabase
      .from('games')
      .upsert(
        {
          ncaa_game_id: eventId,
          home_team: homeTeam,
          away_team: awayTeam,
          start_time: startTime,
          game_date: etDateStr,
        },
        { onConflict: 'ncaa_game_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (gameError || !game) {
      console.warn(`[syncOdds2] Failed to upsert game ${eventId}:`, gameError?.message)
      continue
    }

    const parsed = parseSharpOdds(event.odds)

    const { error: oddsError } = await supabase
      .from('odds')
      .upsert(
        { game_id: game.id, ...parsed, fetched_at: new Date().toISOString() },
        { onConflict: 'game_id,bookmaker' }
      )

    if (oddsError) {
      console.warn(`[syncOdds2] Failed to upsert odds for game ${eventId}:`, oddsError?.message)
      continue
    }

    upserted++
  }

  return { upserted }
}

export async function syncOdds2() {
  console.log('[syncOdds2] Starting...')
  const api = new SharpAPI(process.env.SHARP_API_KEY!)
  console.log('[syncOdds2] API key present:', !!process.env.SHARP_API_KEY)

  const supabase = createServiceClient()
  let total = 0

  const limit = 10
  let offset = 0
  let hasMore = true

  // Only fetch games starting within the next 3 days
  const now = new Date()
  const cutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const pagePromises: Promise<{ upserted: number }>[] = []

  try {
    console.log('[syncOdds2] Fetching NCAAB odds from SharpAPI...')

    while (hasMore) {
      const response = await api.odds.get({
        league: 'ncaab',
        sportsbook: BOOKMAKER,
        market: 'moneyline,point_spread,total_points',
        group_by: 'event',
        limit,
        offset,
      } as any)

      const events: EventWithOdds[] = (response.data as any) ?? []
      const pagination = (response as any).pagination ?? response.meta?.pagination
      hasMore = pagination?.has_more === true
      offset = pagination?.next_offset ?? offset + events.length

      console.log(`[syncOdds2] Page offset=${offset - events.length}: got ${events.length} events, has_more=${hasMore}`)

      if (events.length === 0) break

      total += events.length
      pagePromises.push(processPage(supabase, events))

      // Stop paginating if the last event on this page is beyond the 3-day window
      const lastEvent = events[events.length - 1]
      if (lastEvent?.start_time && new Date(lastEvent.start_time) > cutoff) {
        console.log(`[syncOdds2] Last event on page exceeds 3-day window, stopping pagination`)
        break
      }
    }

    // Wait for all in-flight page processing to complete
    const results = await Promise.all(pagePromises)
    const upserted = results.reduce((sum, r) => sum + r.upserted, 0)

    console.log(`[syncOdds2] Finished. upserted=${upserted} total=${total}`)
    broadcast('odds-updated', { upserted: upserted })
    return { upserted, total }
  } catch (err: any) {
    console.error('[syncOdds2] Fatal error:', err?.message ?? err)
    return { upserted: 0, total, error: `Failed to fetch odds: ${err?.message ?? err}` }
  }
}
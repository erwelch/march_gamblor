import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseOddsApiEvent, type OddsApiEvent } from '@/lib/odds'

// Vercel Cron: runs every 30 minutes during March Madness
// vercel.json: { "crons": [{ "path": "/api/cron/sync-odds", "schedule": "*/30 * * * *" }] }

export async function GET(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const API_KEY = process.env.ODDS_API_KEY
  const url = `https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds?apiKey=${API_KEY}&bookmakers=draftkings&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`

  const res = await fetch(url)
  if (!res.ok) {
    return NextResponse.json({ error: 'Odds API error', status: res.status }, { status: 502 })
  }

  const events: OddsApiEvent[] = await res.json()

  let upserted = 0

  for (const event of events) {
    // Upsert the game record
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

    if (gameError || !game) continue

    const parsed = parseOddsApiEvent(event)
    if (!parsed) continue

    await supabase.from('odds').upsert(
      { game_id: game.id, ...parsed },
      { onConflict: 'game_id,bookmaker' }
    )

    upserted++
  }

  return NextResponse.json({ ok: true, upserted, total: events.length })
}

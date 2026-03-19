import type { FastifyInstance } from 'fastify'
import { SharpAPI } from '@sharp-api/client'
import { syncOdds2 as syncOdds } from '../lib/syncOdds2'
import { createServiceClient } from '../lib/supabase'
import { calculatePayout } from '../lib/odds'
import { broadcast } from '../lib/broadcaster'

/** game_state is returned by the API for live/ended events but not in SDK types */
interface SharpGameState {
  home_score?: number
  away_score?: number
  period?: string | number
  clock?: string
  [key: string]: unknown
}

interface SharpEventWithState {
  id: string
  homeTeam: string
  awayTeam: string
  startTime: string
  isLive: boolean
  status: 'upcoming' | 'live' | 'ended'
  game_state?: SharpGameState
}

async function fetchSharpEventsForDate(api: SharpAPI, date: string): Promise<SharpEventWithState[]> {
  const limit = 50
  const has_score = true // filter for events that have scores (live or ended)
  let offset = 0
  let hasMore = true
  const allEvents: SharpEventWithState[] = []

  while (hasMore) {
    const response = await (api.events.list as any)({
      league: 'ncaab',
      has_score,
      date,
      limit,
      offset,
    })

    const events: SharpEventWithState[] = (response.data as any) ?? []
    const pagination = (response as any).pagination ?? response.meta?.pagination
    hasMore = pagination?.has_more === true
    offset = pagination?.next_offset ?? offset + events.length

    // Only keep live or ended events — upcoming events have no scores
    const relevant = events.filter(
      (e: SharpEventWithState) => e.status === 'live' || e.status === 'ended'
    )
    allEvents.push(...relevant)

    if (events.length === 0) break
  }

  return allEvents
}

async function fetchSharpEvents(api: SharpAPI): Promise<SharpEventWithState[]> {
  const now = new Date()
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10)

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  const [yesterdayEvents, todayEvents] = await Promise.all([
    fetchSharpEventsForDate(api, toDateStr(yesterday)),
    fetchSharpEventsForDate(api, toDateStr(now)),
  ])

  // Deduplicate by event id in case of overlap
  const seen = new Set<string>()
  const combined: SharpEventWithState[] = []
  for (const e of [...yesterdayEvents, ...todayEvents]) {
    if (!seen.has(e.id)) {
      seen.add(e.id)
      combined.push(e)
    }
  }
  return combined
}

export async function cronRoutes(app: FastifyInstance) {
  app.get('/sync-odds', async (request, reply) => {
    console.log(`[cron/sync-odds] Request received from ${request.ip}`)
    if (request.headers['x-cron-api-key'] !== process.env.CRON_API_KEY) {
      console.warn('[cron/sync-odds] Unauthorized request - invalid or missing x-cron-api-key')
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    console.log('[cron/sync-odds] Starting odds sync...')
    const result = await syncOdds()
    if (result.error) {
      console.error('[cron/sync-odds] Sync failed:', result.error)
      return reply.status(502).send({ error: result.error })
    }

    console.log(`[cron/sync-odds] Done. upserted=${result.upserted} total=${result.total}`)
    return reply.send({ ok: true, upserted: result.upserted, total: result.total })
  })

  app.get('/sync-scores', async (request, reply) => {
    console.log(`[cron/sync-scores] Request received from ${request.ip}`)
    if (request.headers['x-cron-api-key'] !== process.env.CRON_API_KEY) {
      console.warn('[cron/sync-scores] Unauthorized request - invalid or missing x-cron-api-key')
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const supabase = createServiceClient()
    const api = new SharpAPI(process.env.SHARP_API_KEY!)

    let allEvents: SharpEventWithState[]
    try {
      allEvents = await fetchSharpEvents(api)
    } catch (err: any) {
      console.error('[cron/sync-scores] Failed to fetch events from SharpAPI:', err?.message ?? err)
      return reply.status(502).send({ error: `Failed to fetch events: ${err?.message ?? err}` })
    }

    console.log(`[cron/sync-scores] Fetched ${allEvents.length} live/ended events`)

    let updated = 0
    let settled = 0

    for (const g of allEvents) {
      const gameState = g.game_state
      const homeScore = gameState?.home_score != null ? Number(gameState.home_score) : null
      const awayScore = gameState?.away_score != null ? Number(gameState.away_score) : null

      const status: 'scheduled' | 'live' | 'final' =
        g.status === 'ended' ? 'final' : g.status === 'live' ? 'live' : 'scheduled'

      const { data: game } = await supabase
        .from('games')
        .update({ home_score: homeScore, away_score: awayScore, status, updated_at: new Date().toISOString() })
        .eq('ncaa_game_id', g.id)
        .select('id, status')
        .single()

      if (!game) continue
      updated++

      if (status === 'final' && homeScore !== null && awayScore !== null) {
        const { data: unsettledBets } = await supabase
          .from('bets')
          .select('*')
          .eq('game_id', game.id)
          .is('result', null)

        if (!unsettledBets?.length) continue

        const { data: oddsRow } = await supabase
          .from('odds')
          .select('*')
          .eq('game_id', game.id)
          .single()

        for (const bet of unsettledBets) {
          let result: 'win' | 'loss' | 'push' = 'loss'
          let payout = 0

          if (bet.market === 'h2h') {
            const homeWon = homeScore > awayScore
            if ((bet.pick === 'home' && homeWon) || (bet.pick === 'away' && !homeWon)) {
              result = 'win'
              payout = calculatePayout(bet.amount, bet.odds_at_place)
            }
          } else if (bet.market === 'spreads' && oddsRow?.home_spread !== null) {
            const spread = oddsRow!.home_spread!
            const adjustedHome = homeScore + spread
            if (adjustedHome === awayScore) {
              result = 'push'
            } else if (
              (bet.pick === 'home' && adjustedHome > awayScore) ||
              (bet.pick === 'away' && adjustedHome < awayScore)
            ) {
              result = 'win'
              payout = calculatePayout(bet.amount, bet.odds_at_place)
            }
          } else if (bet.market === 'totals' && oddsRow?.over_under !== null) {
            const total = homeScore + awayScore
            const line = oddsRow!.over_under!
            if (total === line) {
              result = 'push'
            } else if (
              (bet.pick === 'over' && total > line) ||
              (bet.pick === 'under' && total < line)
            ) {
              result = 'win'
              payout = calculatePayout(bet.amount, bet.odds_at_place)
            }
          }

          await supabase
            .from('bets')
            .update({ result, payout, settled_at: new Date().toISOString() })
            .eq('id', bet.id)
          // Balance is credited by the DB trigger on bets UPDATE (win → payout, push → amount).

          settled++
        }
      }
    }

    if (updated > 0) {
      broadcast('scores-updated', { updated, settled })
    }
    return reply.send({ ok: true, updated, settled })
  })
}
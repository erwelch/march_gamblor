import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth.js'
import { syncOdds } from '../lib/syncOdds.js'

export async function gamesRoutes(app: FastifyInstance) {
  app.get('/games', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    // Sync latest odds
    const syncResult = await syncOdds().catch((e: unknown) => ({ error: String(e), upserted: 0, total: 0 }))
    console.log('[syncOdds]', syncResult)

    const { data: rawGames } = await supabase
      .from('games')
      .select('*, odds(*)')
      .in('status', ['scheduled', 'live'])
      .order('start_time', { ascending: true })
      .limit(50)

    const games = (rawGames ?? []).map((g: any) => ({
      ...g,
      odds: Array.isArray(g.odds) ? (g.odds[0] ?? null) : g.odds,
    }))

    const { data: existingBets } = await supabase
      .from('bets')
      .select('game_id, market')
      .eq('user_id', user.id)
      .is('result', null)

    const bettedKeys = (existingBets ?? []).map((b: any) => `${b.game_id}:${b.market}`)

    return reply.send({ games, bettedKeys })
  })
}
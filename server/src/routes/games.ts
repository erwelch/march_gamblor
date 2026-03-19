import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth'

export async function gamesRoutes(app: FastifyInstance) {
  app.get('/games', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    const { data: rawGames } = await supabase
      .from('games')
      .select('*, odds(*)')
      .in('status', ['scheduled', 'live', 'final'])
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
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth'

export async function gamesRoutes(app: FastifyInstance) {
  app.get('/games', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    // Fetch recent/upcoming games: all scheduled & live, plus final games from last 2 days
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysAgoDate = twoDaysAgo.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    const { data: rawGames } = await supabase
      .from('games')
      .select('*, odds(*)')
      .or(`status.in.(scheduled,live),and(status.eq.final,game_date.gte.${twoDaysAgoDate})`)
      .order('start_time', { ascending: true })
      .limit(200)

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
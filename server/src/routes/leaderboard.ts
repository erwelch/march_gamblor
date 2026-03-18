import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth'

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/leaderboard', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, balance')
      .order('balance', { ascending: false })

    return reply.send({ profiles: profiles ?? [], userId: user.id })
  })

  app.get('/leaderboard/:userId/bets', { preHandler: requireAuth }, async (request, reply) => {
    const supabase = (request as any).supabase
    const { userId } = request.params as { userId: string }

    // Validate userId is a non-empty string (UUID format)
    if (!userId || typeof userId !== 'string' || userId.length > 100) {
      return reply.status(400).send({ error: 'Invalid userId' })
    }

    const { data: bets, error } = await supabase
      .from('bets')
      .select('id, game_id, market, pick, amount, odds_at_place, result, payout, placed_at, games(home_team, away_team, home_score, away_score, status)')
      .eq('user_id', userId)
      .not('result', 'is', null)
      .order('placed_at', { ascending: false })

    if (error) {
      console.error('Leaderboard bets fetch error:', error)
      return reply.status(500).send({ error: 'Failed to fetch bets' })
    }

    return reply.send({ bets: bets ?? [] })
  })
}
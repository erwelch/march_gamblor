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
}
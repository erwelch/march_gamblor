import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth.js'

export async function profileRoutes(app: FastifyInstance) {
  app.get('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, balance')
      .eq('id', user.id)
      .single()

    return reply.send({ profile: profile ?? { username: '', balance: 0 } })
  })
}
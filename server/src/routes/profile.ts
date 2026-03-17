import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth.js'
import { createServiceClient } from '../lib/supabase.js'

export async function profileRoutes(app: FastifyInstance) {
  app.get('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    let { data: profile } = await supabase
      .from('profiles')
      .select('username, balance')
      .eq('id', user.id)
      .single()

    if (!profile) {
      const username = user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'player'
      const serviceClient = createServiceClient()
      const { data: newProfile } = await serviceClient
        .from('profiles')
        .upsert({ id: user.id, username, balance: 1000 }, { onConflict: 'id', ignoreDuplicates: true })
        .select('username, balance')
        .single()
      profile = newProfile ?? { username, balance: 1000 }
    }

    return reply.send({ profile })
  })
}
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth'
import { createServiceClient } from '../lib/supabase'

export async function profileRoutes(app: FastifyInstance) {
  app.get('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    let { data: profile } = await supabase
      .from('profiles')
      .select('username, balance, approved')
      .eq('id', user.id)
      .single()

    if (!profile) {
      const username = user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'player'
      const serviceClient = createServiceClient()
      const { data: newProfile } = await serviceClient
        .from('profiles')
        .upsert({ id: user.id, username, balance: 1000, approved: false }, { onConflict: 'id', ignoreDuplicates: true })
        .select('username, balance, approved')
        .single()
      profile = newProfile ?? { username, balance: 1000, approved: false }
    }

    return reply.send({ profile })
  })

  // Honor-system balance top-up
  app.patch('/profile/balance', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const body = request.body as { amount?: unknown }
    const amount = Number(body?.amount)

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
      return reply.status(400).send({ error: 'Amount must be a positive number up to 1000.' })
    }

    const serviceClient = createServiceClient()
    const { data: profile, error } = await serviceClient
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      return reply.status(404).send({ error: 'Profile not found.' })
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('profiles')
      .update({ balance: profile.balance + amount })
      .eq('id', user.id)
      .select('balance')
      .single()

    if (updateError || !updated) {
      return reply.status(500).send({ error: 'Failed to update balance.' })
    }

    return reply.send({ balance: updated.balance })
  })
}
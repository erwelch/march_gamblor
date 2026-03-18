import type { FastifyRequest, FastifyReply } from 'fastify'
import { createUserClient, createServiceClient } from '../lib/supabase'

/**
 * Extract the Supabase access token from cookies or Authorization header.
 * Supabase JS client stores tokens in cookies named like sb-<ref>-auth-token.
 */
function extractAccessToken(request: FastifyRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Check query param (used by EventSource which cannot send custom headers)
  const query = request.query as Record<string, string>
  if (typeof query?.token === 'string' && query.token.length > 0) {
    return query.token
  }

  // Check cookies for Supabase auth token
  const cookies = request.cookies
  for (const [name, value] of Object.entries(cookies)) {
    if (name.startsWith('sb-') && name.endsWith('-auth-token') && value) {
      // The cookie value might be a JSON-encoded array [access_token, refresh_token]
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed[0]
        return value
      } catch {
        return value
      }
    }
  }
  return null
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = extractAccessToken(request)
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const supabase = createUserClient(token)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  // Attach to request for downstream use
  ;(request as any).user = user
  ;(request as any).supabase = supabase

  // Skip approval check for the profile endpoint itself (needed to read approval status)
  if (request.url === '/api/profile' && request.method === 'GET') return

  // Block unapproved users from all other protected routes
  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('approved')
    .eq('id', user.id)
    .single()

  if (!profile?.approved) {
    return reply.status(403).send({ error: 'Your account is pending admin approval.' })
  }
}
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth'
import { addClient, removeClient } from '../lib/broadcaster'

export async function eventsRoute(app: FastifyInstance) {
  app.get('/events', { preHandler: requireAuth }, async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    // Send an initial heartbeat so the client knows the connection is open
    reply.raw.write(': connected\n\n')

    const client = addClient(reply)

    // Keep-alive ping every 25 seconds
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n')
      } catch {
        clearInterval(heartbeat)
      }
    }, 25_000)

    request.socket.on('close', () => {
      clearInterval(heartbeat)
      removeClient(client)
    })

    // Never resolve — the connection stays open until client disconnects
    await new Promise<void>((resolve) => {
      request.socket.on('close', resolve)
    })
  })
}

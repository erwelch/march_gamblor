/**
 * Simple SSE broadcaster. Routes call `broadcast()` after data changes;
 * connected clients receive the event and refresh their data.
 */

type Client = {
  reply: import('fastify').FastifyReply
}

const clients = new Set<Client>()

export function addClient(reply: import('fastify').FastifyReply): Client {
  const client: Client = { reply }
  clients.add(client)
  return client
}

export function removeClient(client: Client) {
  clients.delete(client)
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of clients) {
    try {
      client.reply.raw.write(payload)
    } catch {
      clients.delete(client)
    }
  }
}

export function clientCount(): number {
  return clients.size
}

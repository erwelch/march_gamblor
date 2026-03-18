import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { betsRoutes } from './routes/bets'
import { gamesRoutes } from './routes/games'
import { leaderboardRoutes } from './routes/leaderboard'
import { profileRoutes } from './routes/profile'
import { cronRoutes } from './routes/cron'
import { eventsRoute } from './routes/events'

const __dirname = import.meta.dirname

const app = Fastify({ logger: true })

await app.register(cookie)
await app.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
})

// Health check
app.get('/api/health', async (_request, reply) => {
  return reply.send({ status: 'ok' })
})

// API routes
await app.register(betsRoutes, { prefix: '/api' })
await app.register(gamesRoutes, { prefix: '/api' })
await app.register(leaderboardRoutes, { prefix: '/api' })
await app.register(profileRoutes, { prefix: '/api' })
await app.register(cronRoutes, { prefix: '/api/cron' })
await app.register(eventsRoute, { prefix: '/api' })

// Serve built client in production
const clientDist = path.join(__dirname, '../../client/dist')
await app.register(fastifyStatic, {
  root: clientDist,
  prefix: '/',
  wildcard: false,
})

// SPA fallback: serve index.html for all non-API routes
const indexHtml = fs.readFileSync(path.join(clientDist, 'index.html'))

app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith('/api/')) {
    return reply.status(404).send({ error: 'Not found' })
  }
  return reply.type('text/html').send(indexHtml)
})

const port = parseInt(process.env.PORT ?? '3000', 10)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`Server running on ${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
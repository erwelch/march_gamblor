import { useEffect, useRef } from 'react'
import { getAccessToken } from './supabase'

type EventHandler = (data: unknown) => void

/**
 * Subscribe to server-sent events from /api/events.
 * `handlers` maps event names to callbacks. Reconnects automatically on error.
 */
export function useSSE(handlers: Record<string, EventHandler>) {
  // Keep a stable ref so callers don't need to memoize the handlers object
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    async function connect() {
      if (stopped) return

      // EventSource doesn't support custom headers, so we pass the token as a
      // query param. The server reads it from there when the header is absent.
      const token = await getAccessToken()
      const url = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events'

      es = new EventSource(url)

      for (const eventName of Object.keys(handlersRef.current)) {
        es.addEventListener(eventName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            handlersRef.current[eventName]?.(data)
          } catch {
            handlersRef.current[eventName]?.(e.data)
          }
        })
      }

      es.onerror = () => {
        es?.close()
        if (!stopped) {
          reconnectTimer = setTimeout(connect, 5_000)
        }
      }
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

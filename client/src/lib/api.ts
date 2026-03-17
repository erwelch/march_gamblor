import { getAccessToken } from './supabase'

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken()
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

export async function apiFetch(path: string, init?: RequestInit) {
  const headers = await authHeaders()
  const res = await fetch(path, { ...init, headers: { ...headers, ...init?.headers } })
  return res
}

import { supabase } from './supabaseClient'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Calls the FastAPI backend with the current Supabase access token as a bearer
 * token. The backend verifies it and resolves the caller's workspace, so the
 * frontend never decides scope on its own.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const token = data.session?.access_token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  const text = await response.text()
  const body: unknown = text ? safeJson(text) : null

  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body ? String((body as { detail: unknown }).detail) : response.statusText
    throw new ApiError(response.status, detail || `Request failed with ${response.status}`, body)
  }
  return body as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

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

/*
  The workspace every scoped request is sent for. Set by WorkspaceProvider when
  the active workspace changes; the backend checks membership on each request.
*/
let activeWorkspaceId: string | null = null

export function setApiWorkspace(id: string | null) {
  activeWorkspaceId = id
}

interface ApiInit extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Send the request without the active workspace header. */
  unscoped?: boolean
}

/**
 * Calls the FastAPI backend with the current Supabase access token as a bearer
 * token and the active workspace as X-Workspace-Id. The backend verifies both,
 * so the frontend never decides scope on its own.
 */
export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, unscoped, ...rest } = init
  const headers = new Headers(rest.headers)
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const token = data.session?.access_token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (activeWorkspaceId && !unscoped) headers.set('X-Workspace-Id', activeWorkspaceId)

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers, body: payload })
  } catch {
    throw new ApiError(0, "Can't reach the Meridian API. Check that the backend is running.", null)
  }

  const text = await response.text()
  const parsed: unknown = text ? safeJson(text) : null

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(parsed, response), parsed)
  }
  return parsed as T
}

function errorMessage(body: unknown, response: Response): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    // FastAPI validation errors: [{ msg: "..." }, ...]
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object' && 'msg' in detail[0]) {
      return String((detail[0] as { msg: unknown }).msg).replace(/^Value error, /, '')
    }
  }
  return response.statusText || `Request failed (${response.status})`
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

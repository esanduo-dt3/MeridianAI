import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { missingSupabaseConfig, supabase } from '../lib/supabaseClient'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  /** Why the last Google sign-in failed on its way back to Meridian, if it did. */
  authError: string | null
  clearAuthError: () => void
  /** Starts Google sign-in and returns the Google URL the browser is sent to. */
  signInWithGoogle: () => Promise<string>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const CALLBACK_PARAMS = ['code', 'error', 'error_code', 'error_description', 'state', 'sb']

/*
  Completes an OAuth redirect exactly once per page load. Module scope, so React
  StrictMode's double-run effects in development cannot exchange the same code twice.
  Resolves to an error message, or null when there was nothing to report.
*/
let callbackResult: Promise<string | null> | null = null

function completeOAuthRedirect(): Promise<string | null> {
  callbackResult ??= (async () => {
    if (!supabase) return null
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    const code = url.searchParams.get('code')
    const errorDescription =
      url.searchParams.get('error_description') ?? hash.get('error_description') ?? url.searchParams.get('error')

    if (!code && !errorDescription) return null

    // Strip auth parameters from the address bar so a refresh doesn't replay them.
    CALLBACK_PARAMS.forEach((key) => url.searchParams.delete(key))
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)

    if (errorDescription) {
      console.error('Meridian: Google sign-in returned an error:', errorDescription)
      return errorDescription
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code!)
    if (error) {
      console.error('Meridian: could not complete Google sign-in:', error)
      return error.message
    }
    return null
  })()
  return callbackResult
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    let ready = false

    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      // Until the redirect is handled, an empty session is not a final answer.
      if (ready) setLoading(false)
    })

    completeOAuthRedirect()
      .then(async (message) => {
        const { data: current } = await client.auth.getSession()
        if (!active) return
        if (message) setAuthError(message)
        setSession(current.session)
      })
      .finally(() => {
        ready = true
        if (active) setLoading(false)
      })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error(`Sign-in is not configured. Missing ${missingSupabaseConfig.join(', ')}.`)
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Redirect ourselves so the caller can tell when the browser didn't leave the page.
      options: { redirectTo: `${window.location.origin}/tasks`, skipBrowserRedirect: true },
    })
    if (error) throw error
    if (!data.url) throw new Error('Google sign-in could not start. Try again.')
    window.location.assign(data.url)
    return data.url
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const clearAuthError = useCallback(() => setAuthError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: Boolean(supabase),
      authError,
      clearAuthError,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, authError, clearAuthError, signInWithGoogle, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

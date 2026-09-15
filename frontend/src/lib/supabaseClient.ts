import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const missingSupabaseConfig: string[] = [
  !url && 'VITE_SUPABASE_URL',
  !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter((name): name is string => Boolean(name))

if (missingSupabaseConfig.length > 0) {
  console.error(
    `Meridian: missing ${missingSupabaseConfig.join(', ')}. Copy frontend/.env.example to frontend/.env and fill it in.`,
  )
}

/**
 * The single Supabase browser client. Multiple instances cause duplicate auth
 * listeners and inconsistent token refresh, so everything imports this one.
 * Null only when configuration is missing, which the sign-in screen reports.
 */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

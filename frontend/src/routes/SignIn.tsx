import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { GoogleLogo, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { CitationSpecimen } from '../components/CitationSpecimen'
import { Wordmark } from '../components/Wordmark'
import { missingSupabaseConfig } from '../lib/supabaseClient'

export function SignIn() {
  const { session, loading, configured, signInWithGoogle } = useAuth()
  const location = useLocation()
  const reduce = useReducedMotion()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/signin' ? from : '/ask'} replace />
  }

  async function handleSignIn() {
    setError(null)
    setPending(true)
    try {
      await signInWithGoogle()
      // The browser now redirects to Google; keep the button busy until it does.
    } catch (err) {
      setPending(false)
      setError(err instanceof Error ? err.message : 'Google sign-in could not start. Try again.')
    }
  }

  return (
    <div className="min-h-dvh px-5 sm:px-8">
      <div className="mx-auto grid min-h-dvh max-w-[1240px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <main className="flex flex-col py-8 lg:py-10">
          <Wordmark size="md" />

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="my-auto max-w-[30rem] py-14"
          >
            <h1 className="font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] text-ink sm:text-[56px]">
              Answers you can check.
            </h1>
            <p className="mt-5 max-w-[40ch] text-[17px] leading-relaxed text-ink-2">
              Meridian shows the exact passage behind every answer, and asks before it changes anything in your workspace.
            </p>

            <div className="mt-9 flex flex-col items-start gap-3">
              <Button
                onClick={handleSignIn}
                loading={pending}
                disabled={!configured}
                leading={<GoogleLogo aria-hidden size={18} weight="bold" />}
                className="px-5"
              >
                Continue with Google
              </Button>

              {error && (
                <p role="alert" className="flex max-w-[42ch] gap-2 text-sm text-danger">
                  <WarningCircle aria-hidden size={18} weight="bold" className="mt-px shrink-0" />
                  {error}
                </p>
              )}

              {!configured && (
                <p role="alert" className="flex max-w-[46ch] gap-2 text-sm leading-relaxed text-flag">
                  <WarningCircle aria-hidden size={18} weight="bold" className="mt-0.5 shrink-0" />
                  <span>
                    Sign-in isn't configured. Add{' '}
                    <code className="font-mono text-[13px]">{missingSupabaseConfig.join(', ')}</code> to{' '}
                    <code className="font-mono text-[13px]">frontend/.env</code> and restart the dev server.
                  </span>
                </p>
              )}
            </div>
          </motion.div>

          <p className="max-w-[52ch] text-xs leading-relaxed text-ink-3">
            AI answers can be incomplete or wrong. Confidence values are uncalibrated, and low-confidence answers go to a
            person for review.
          </p>
        </main>

        <section
          aria-label="Example of a traced answer"
          className="relative hidden items-center justify-center py-10 lg:flex"
        >
          <div aria-hidden className="absolute inset-y-10 left-0 w-px bg-rule" />
          <CitationSpecimen />
        </section>
      </div>
    </div>
  )
}

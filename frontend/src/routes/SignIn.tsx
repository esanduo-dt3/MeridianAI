import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, GoogleLogo, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { CitationSpecimen } from '../components/CitationSpecimen'
import { Wordmark } from '../components/Wordmark'
import { ThemeToggle } from '../theme/ThemeToggle'
import { missingSupabaseConfig } from '../lib/supabaseClient'
import {
  CapabilitiesSection,
  ClosingCta,
  HowItWorksSection,
  LandingFooter,
  TrustSection,
  UseCasesSection,
} from './landing/LandingSections'

/** In-page navigation for the landing page. Anchors only: there is no second public route. */
const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#capabilities', label: 'What you get' },
  { href: '#use-cases', label: 'Who it helps' },
  { href: '#trust', label: 'Limits' },
]

/**
 * Public landing page.
 *
 * Explains what Meridian does and who it is for, and carries the configured
 * Google authentication entry point together with its explicit failure states.
 */
// PUBLIC_INTERFACE
export function SignIn() {
  const { session, loading, configured, authError, clearAuthError, signInWithGoogle } = useAuth()
  const location = useLocation()
  const reduce = useReducedMotion()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stalled, setStalled] = useState(false)

  // Returning with the Back button (for example from a Google error page) restores
  // this page from the back-forward cache with the button still busy. Re-enable it.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setPending(false)
        setStalled(false)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/signin' ? from : '/tasks'} replace />
  }

  async function handleSignIn() {
    setError(null)
    setStalled(false)
    clearAuthError()
    setPending(true)
    try {
      await signInWithGoogle()
      // The browser is now leaving for Google. If it is still here after a few
      // seconds, something blocked the navigation (for example an in-editor preview).
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          setPending(false)
          setStalled(true)
        }
      }, 4000)
    } catch (err) {
      setPending(false)
      setError(err instanceof Error ? err.message : 'Google sign-in could not start. Try again.')
    }
  }

  return (
    <div className="min-h-dvh bg-paper">
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-(--radius-control) focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-on-ink"
      >
        Skip to content
      </a>

      {/* Sticky floating glass header: wordmark, section anchors, sign-in shortcut. */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div className="liquid-glass mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-4 rounded-[18px] px-4 sm:px-6">
          <Wordmark size="md" />

          <nav aria-label="Landing page sections" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-(--radius-control) px-3 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-[var(--glass-raised)] hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignIn}
              disabled={!configured || pending}
              className="hidden min-h-10 cursor-pointer items-center gap-2 rounded-(--radius-control) bg-ink px-4 text-sm font-medium text-on-ink transition-colors duration-150 hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
            >
              Sign in
              <ArrowRight aria-hidden size={16} weight="bold" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative isolate">
        {/* Static ambience only: a token-coloured wash behind the hero. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(70%_100%_at_50%_0%,var(--color-cobalt-wash),transparent)]"
        />

        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
          {/* ------------------------------- Hero ------------------------------- */}
          <main
            id="hero"
            className="grid grid-cols-1 items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[34rem]"
            >
              <p className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-ink-2 uppercase">
                Workspace assistant for real documents
              </p>

              <h1 className="mt-5 font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] text-ink sm:text-[56px]">
                Answers you can check.
              </h1>

              <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
                Meridian turns your team's documents into a searchable assistant. Ask a question in plain language, get an
                answer drawn only from your own files, and see the exact passage behind it before you act.
              </p>

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
                <li>Grounded in your documents</li>
                <li aria-hidden className="text-ink-3">
                  ·
                </li>
                <li>Every answer cited</li>
                <li aria-hidden className="text-ink-3">
                  ·
                </li>
                <li>Nothing changes without approval</li>
              </ul>

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

                <p className="text-sm text-ink-3">Free to start. Create a workspace in under a minute.</p>

                {error && (
                  <p role="alert" className="flex max-w-[42ch] gap-2 text-sm text-danger">
                    <WarningCircle aria-hidden size={18} weight="bold" className="mt-px shrink-0" />
                    {error}
                  </p>
                )}

                {authError && !pending && (
                  <p role="alert" className="flex max-w-[46ch] gap-2 text-sm leading-relaxed text-danger">
                    <WarningCircle aria-hidden size={18} weight="bold" className="mt-0.5 shrink-0" />
                    <span>
                      Google sign-in didn't finish. <span className="font-medium">{authError}</span>
                    </span>
                  </p>
                )}

                {stalled && (
                  <p role="alert" className="flex max-w-[46ch] gap-2 text-sm leading-relaxed text-flag">
                    <WarningCircle aria-hidden size={18} weight="bold" className="mt-0.5 shrink-0" />
                    <span>
                      Your browser didn't open Google sign-in. If you're using a preview inside your editor, open{' '}
                      <code className="font-mono text-[13px]">{window.location.origin}</code> in Chrome or Safari and sign
                      in there. Sign-in has to start and finish in the same browser.
                    </span>
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

            {/* A real specimen of a traced answer, so the promise is visible, not asserted. */}
            <section aria-label="Example of a traced answer" className="relative hidden justify-center lg:flex">
              <CitationSpecimen />
            </section>
          </main>

          <HowItWorksSection />
          <CapabilitiesSection />
          <UseCasesSection />
          <TrustSection />
          <ClosingCta onSignIn={handleSignIn} disabled={!configured || pending} />
          <LandingFooter />
        </div>
      </div>
    </div>
  )
}

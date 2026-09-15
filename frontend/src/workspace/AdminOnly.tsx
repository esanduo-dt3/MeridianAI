import type { ReactNode } from 'react'
import { LockSimple } from '@phosphor-icons/react'
import { EmptyState } from '../components/EmptyState'
import { useWorkspace } from './WorkspaceProvider'

/** Renders children for Admins; explains the restriction to Members. The API enforces it too. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, active } = useWorkspace()
  if (isAdmin) return <>{children}</>
  return (
    <EmptyState icon={LockSimple} title="Only Admins can see this page">
      You're a Member of {active?.name ?? 'this workspace'}. Ask one of its Admins if you need access.
    </EmptyState>
  )
}

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EnvelopeSimple, SignOut, Trash, UserPlus, UsersThree } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, RoleBadge, Skeleton } from '../components/Feedback'
import { SelectField, TextField } from '../components/Field'
import { OperationalHeader } from '../components/OperationalHeader'
import { apiFetch } from '../lib/api'
import { errorText } from '../lib/queryClient'
import type { AddMemberResult, AuthRole, Invite, Member, Roster } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Renders the workspace roster, invitations, roles, and membership actions. */
// PUBLIC_INTERFACE
export function MembersPage() {
  const { active, isAdmin } = useWorkspace()
  const rosterKey = wsKey(active?.id, 'members')
  const roster = useQuery({ queryKey: rosterKey, queryFn: () => apiFetch<Roster>('/members') })

  return (
    <div className="flex flex-col gap-5">
      <OperationalHeader
        eyebrow="Workspace access"
        title="Members"
        description={
          isAdmin
            ? `Add people to ${active?.name} and choose whether each one is an Admin or a Member.`
            : `People in ${active?.name}. Admins manage who's here and what they can do.`
        }
        status={
          roster.isSuccess ? (
            <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink-2 tabular">
              {roster.data.members.length} {roster.data.members.length === 1 ? 'member' : 'members'}
            </span>
          ) : undefined
        }
      />

      {isAdmin && <InviteForm />}

      {roster.isPending ? (
        <RosterSkeleton />
      ) : roster.isError ? (
        <ErrorState title="Members couldn't be loaded" message={errorText(roster.error)} onRetry={() => void roster.refetch()} />
      ) : (
        <>
          <MemberList members={roster.data.members} />
          {isAdmin && <InviteList invites={roster.data.invites} />}
        </>
      )}

      <LeaveWorkspace />
    </div>
  )
}

function InviteForm() {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AuthRole>('Member')
  const [error, setError] = useState<string | null>(null)

  const add = useMutation({
    mutationFn: () => apiFetch<AddMemberResult>('/admin/members', { method: 'POST', body: { email, auth_role: role } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'members') })
      toast.success(
        result.outcome === 'added'
          ? `${email.trim()} added as ${role}`
          : `Invite saved. ${email.trim()} joins as ${role} when they first sign in.`,
      )
      setEmail('')
      setRole('Member')
    },
    onError: (err) => setError(errorText(err, "That person couldn't be added. Try again.")),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    add.mutate()
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-(--radius-panel) border border-rule bg-surface p-5 shadow-(--shadow-panel) sm:p-6"
    >
      <h2 className="flex items-center gap-2 font-medium text-ink">
        <UserPlus aria-hidden size={18} weight="bold" className="text-ink-3" />
        Add someone
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        If they haven't signed in to Meridian yet, they'll join automatically the first time they do.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-start">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="name@company.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (error) setError(null)
          }}
          error={error}
        />
        <SelectField label="Role" value={role} onChange={(event) => setRole(event.target.value as AuthRole)}>
          <option value="Member">Member</option>
          <option value="Admin">Admin</option>
        </SelectField>
        <Button type="submit" loading={add.isPending} className="sm:mt-[26px]">
          Add
        </Button>
      </div>
    </form>
  )
}

function MemberList({ members }: { members: Member[] }) {
  const { user } = useAuth()
  const { isAdmin } = useWorkspace()

  if (members.length === 0) {
    return (
      <EmptyState icon={UsersThree} title="No members">
        This workspace has no members, which shouldn't happen. Reload the page.
      </EmptyState>
    )
  }

  return (
    <section aria-labelledby="members-heading">
      <h2 id="members-heading" className="mb-3 text-sm font-medium text-ink-2">
        {members.length} {members.length === 1 ? 'member' : 'members'}
      </h2>
      <ul className="surface-card divide-y divide-rule overflow-hidden">
        {members.map((member) => (
          <MemberRow key={member.id} member={member} isSelf={member.user_id === user?.id} canManage={isAdmin} />
        ))}
      </ul>
    </section>
  )
}

function MemberRow({ member, isSelf, canManage }: { member: Member; isSelf: boolean; canManage: boolean }) {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const name = member.profile.full_name || member.profile.email
  const invalidate = () => queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'members') })

  const changeRole = useMutation({
    mutationFn: (auth_role: AuthRole) => apiFetch<Member>(`/admin/members/${member.id}`, { method: 'PATCH', body: { auth_role } }),
    onSuccess: (updated) => {
      void invalidate()
      toast.success(`${name} is now ${updated.auth_role === 'Admin' ? 'an Admin' : 'a Member'}`)
    },
    onError: (err) => toast.error(errorText(err, "The role couldn't be changed.")),
  })

  // The team role is what this person does, not what they may do in Meridian.
  // The agent reads it to suggest an assignee; it never grants permissions.
  const [teamRole, setTeamRole] = useState(member.team_role ?? '')
  const saveTeamRole = useMutation({
    mutationFn: (team_role: string) =>
      apiFetch<Member>(`/admin/members/${member.id}`, { method: 'PATCH', body: { team_role } }),
    onSuccess: (updated) => {
      setTeamRole(updated.team_role ?? '')
      void invalidate()
      toast.success(updated.team_role ? `${name} is the ${updated.team_role}` : `Cleared the team role for ${name}`)
    },
    onError: (err) => {
      setTeamRole(member.team_role ?? '')
      toast.error(errorText(err, "The team role couldn't be saved."))
    },
  })

  const commitTeamRole = () => {
    const next = teamRole.trim()
    if (next !== (member.team_role ?? '')) saveTeamRole.mutate(next)
  }

  const remove = useMutation({
    mutationFn: () => apiFetch<void>(`/admin/members/${member.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setConfirming(false)
      void invalidate()
      toast.success(`${name} was removed from ${active?.name}`)
    },
  })

  return (
    <li className="row-interactive flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-5">
      <Avatar name={member.profile.full_name} email={member.profile.email} src={member.profile.avatar_url} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">
          {name}
          {isSelf && <span className="ml-1.5 text-sm font-normal text-ink-3">(you)</span>}
        </p>
        <p className="truncate text-sm text-ink-3">
          {member.profile.full_name ? `${member.profile.email} · ` : ''}Joined {dateFormat.format(new Date(member.joined_at))}
          {!canManage && member.team_role ? ` · ${member.team_role}` : ''}
        </p>
      </div>

      {canManage ? (
        <div className="flex items-center gap-1">
          <TextField
            label={`Team role for ${name}`}
            hideLabel
            placeholder="Team role"
            value={teamRole}
            maxLength={80}
            disabled={saveTeamRole.isPending}
            onChange={(event) => setTeamRole(event.target.value)}
            onBlur={commitTeamRole}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setTeamRole(member.team_role ?? '')
            }}
            className="min-h-10 w-40 text-sm"
          />
          <SelectField
            label={`Role for ${name}`}
            hideLabel
            value={member.auth_role}
            disabled={changeRole.isPending}
            onChange={(event) => changeRole.mutate(event.target.value as AuthRole)}
            className="min-h-10 w-32 text-sm"
          >
            <option value="Member">Member</option>
            <option value="Admin">Admin</option>
          </SelectField>
          {!isSelf && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Remove ${name}`}
              title="Remove from workspace"
              className="grid size-10 cursor-pointer place-items-center rounded-lg text-ink-3 transition-colors hover:bg-danger-wash hover:text-danger"
            >
              <Trash size={17} weight="bold" />
            </button>
          )}
        </div>
      ) : (
        <RoleBadge role={member.auth_role} />
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) remove.reset()
        }}
        title={`Remove ${name}?`}
        description={`They'll lose access to everything in ${active?.name}. You can add them again later.`}
        confirmLabel="Remove member"
        onConfirm={() => remove.mutate()}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : null}
      />
    </li>
  )
}

function InviteList({ invites }: { invites: Invite[] }) {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()

  const revoke = useMutation({
    mutationFn: (invite: Invite) => apiFetch<void>(`/admin/invites/${invite.id}`, { method: 'DELETE' }),
    onSuccess: (_data, invite) => {
      void queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'members') })
      toast.success(`Invite for ${invite.email} revoked`)
    },
    onError: (err) => toast.error(errorText(err, "The invite couldn't be revoked.")),
  })

  if (invites.length === 0) return null

  return (
    <section aria-labelledby="invites-heading">
      <h2 id="invites-heading" className="mb-3 text-sm font-medium text-ink-2">
        Waiting to join · {invites.length}
      </h2>
      <ul className="divide-y divide-rule overflow-hidden rounded-(--radius-panel) border border-dashed border-rule-strong">
        {invites.map((invite) => (
          <li key={invite.id} className="row-interactive flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-3">
              <EnvelopeSimple aria-hidden size={17} weight="bold" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink">{invite.email}</p>
              <p className="text-sm text-ink-3">Invited {dateFormat.format(new Date(invite.created_at))} · joins on first sign-in</p>
            </div>
            <RoleBadge role={invite.auth_role} />
            <Button
              variant="ghost"
              onClick={() => revoke.mutate(invite)}
              loading={revoke.isPending && revoke.variables?.id === invite.id}
              className="min-h-10 text-sm"
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function LeaveWorkspace() {
  const { active, refetch } = useWorkspace()
  const [confirming, setConfirming] = useState(false)
  const leave = useMutation({
    mutationFn: () => apiFetch<void>('/members/me', { method: 'DELETE' }),
    onSuccess: () => {
      setConfirming(false)
      toast.success(`You left ${active?.name}`)
      refetch()
    },
  })

  return (
    <section className="flex flex-col items-start gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-medium text-ink">Leave this workspace</h2>
        <p className="text-sm text-ink-2">You'll lose access until an Admin adds you again.</p>
      </div>
      <Button variant="secondary" onClick={() => setConfirming(true)} leading={<SignOut aria-hidden size={16} weight="bold" />}>
        Leave workspace
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) leave.reset()
        }}
        title={`Leave ${active?.name}?`}
        description="You'll stop seeing its documents, notes and tasks."
        confirmLabel="Leave workspace"
        onConfirm={() => leave.mutate()}
        pending={leave.isPending}
        error={leave.isError ? errorText(leave.error) : null}
      />
    </section>
  )
}

function RosterSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading members">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-(--radius-panel) border border-rule bg-surface px-5 py-4">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  )
}

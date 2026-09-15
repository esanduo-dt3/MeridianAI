/** Shapes returned by the Meridian API. Keep in sync with backend/app/api. */

export type AuthRole = 'Admin' | 'Member'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
}

export interface WorkspaceSummary {
  id: string
  name: string
  auth_role: AuthRole
  created_at: string
}

export interface MeResponse {
  user: Profile
  workspaces: WorkspaceSummary[]
}

export interface Member {
  id: string
  user_id: string
  auth_role: AuthRole
  joined_at: string
  profile: { email: string; full_name: string | null; avatar_url: string | null }
}

export interface Invite {
  id: string
  email: string
  auth_role: AuthRole
  created_at: string
}

export interface Roster {
  members: Member[]
  invites: Invite[]
}

export interface AddMemberResult {
  outcome: 'added' | 'invited'
  member: Member | null
  invite: Invite | null
}

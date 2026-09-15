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

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent'

export interface Person {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  position: number
  parent_task_id: string | null
  due_date: string | null
  source: 'manual' | 'agent'
  created_at: string
  updated_at: string
  completed_at: string | null
  assignee: Person | null
  created_by: Person | null
}

export interface Proposal {
  id: string
  reasoning: string
  proposed_payload: {
    title?: string
    description?: string
    priority?: Priority
    due_date?: string
    assignee_id?: string
    parent_task_id?: string
  }
  created_at: string
}

export interface TaskBoard {
  tasks: Task[]
  proposals: Proposal[]
}

export interface TaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: Priority
  position?: number
  due_date?: string | null
  assignee_id?: string | null
  parent_task_id?: string | null
}

export type ParsedStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface DocumentSummary {
  id: string
  file_name: string
  doc_type: 'pdf' | 'docx' | null
  mime_type: string
  size_bytes: number
  parsed_status: ParsedStatus
  parse_error: string | null
  page_count: number | null
  chunk_count: number
  parse_stats: Record<string, number>
  created_at: string
  processed_at: string | null
  uploaded_by: { id: string; email: string; full_name: string | null } | null
}

export interface ChunkInfo {
  id: string
  chunk_index: number
  /** Unicode code point offsets into DocumentDetail.content_text. */
  char_start: number
  char_end: number
  page: number | null
  section: string
  kind: 'text' | 'table' | 'code'
  token_count: number
}

export interface DocumentDetail extends DocumentSummary {
  content_text: string | null
  chunks: ChunkInfo[]
}

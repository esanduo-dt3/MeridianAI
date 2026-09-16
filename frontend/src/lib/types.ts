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
  /** While processing: reading the file, then embedding its saved passages. */
  processing_stage: 'parsing' | 'embedding' | null
  parse_error: string | null
  page_count: number | null
  chunk_count: number
  embedded_count: number
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
  /** False while the document is still embedding; the passage is not searchable yet. */
  embedded: boolean
}

export interface DocumentDetail extends DocumentSummary {
  content_text: string | null
  chunks: ChunkInfo[]
}

/** A Tiptap/ProseMirror JSON document: the note's block tree. */
export interface BlockDoc {
  type: 'doc'
  content?: Array<Record<string, unknown>>
}

export interface NoteSummary {
  id: string
  title: string
  preview: string
  created_at: string
  updated_at: string
  created_by: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null
}

export interface Note extends NoteSummary {
  content: BlockDoc
}

/*
  Agent answers (backend/app/api/ask.py). A confidence value is always carried
  with its label, so the UI can never render a bare number as a probability.
*/

export type RetrievalProfile = 'lookup' | 'explore' | 'summarize'

export interface Confidence {
  /** Null when no cited passage carried a rerank score. */
  value: number | null
  label: 'uncalibrated'
  basis: string
}

/** One [n] marker in an answer, resolved to the exact passage it points at. */
export interface Citation {
  ordinal: number
  chunk_id: string
  document_id: string
  file_name: string
  /** Unicode code point offsets into the document's content_text. */
  char_start: number
  char_end: number
  page: number | null
  section: string
  excerpt: string
}

export interface RetrievalSummary {
  run_id: string
  attempts: number
  grade: 'good' | 'weak'
  final_query: string
  top_score: number | null
  reranked: boolean
  latency_ms: number
}

export interface AskRequest {
  question: string
  document_ids?: string[]
  profile?: RetrievalProfile
}

export interface AskResponse {
  answer_id: string
  question: string
  answer: string
  answerable: boolean
  citations: Citation[]
  confidence: Confidence
  grounded: boolean
  flagged: boolean
  flag_reasons: string[]
  retrieval: RetrievalSummary
  /** The model that actually answered; free-tier fallbacks change it (D-032). */
  model: string
}

export interface AnswerListItem {
  id: string
  question: string
  answer: string
  confidence: Confidence
  groundedness_pass: boolean
  flagged: boolean
  flag_reasons: string[]
  created_at: string
  /** Null for answers recorded before the model column existed (D-031). */
  model: string | null
}

/* The workspace agent (backend/app/api/agent_chat.py). */

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentStep {
  tool: string
  arguments: Record<string, unknown>
  ok: boolean
  summary: string
}

export interface AgentProposal {
  id: string
  title: string
  description?: string
  priority?: Priority
  due_date?: string
  assignee_email?: string | null
  reasoning: string
  created_at: string
}

export interface AgentTaskRef {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  due_date: string | null
  assignee: string | null
}

export interface ChatResponse {
  reply: string
  steps: AgentStep[]
  proposals: AgentProposal[]
  tasks: AgentTaskRef[]
  citations: Citation[]
  injection_detected: boolean
  models: string[]
}

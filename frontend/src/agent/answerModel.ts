import type { Citation } from '../lib/types'

/*
  Pure helpers for reading an answer. Kept out of the component files so the
  regex state and the reason table are not tied to a render.
*/

/** Written out from the reasons recorded in backend/app/rag/answer.py. */
const FLAG_REASONS: Record<string, string> = {
  no_supporting_passages: 'Nothing in this workspace matched the question.',
  no_citations: 'The answer cited no passage, so it cannot be traced.',
  not_answerable_from_documents: 'The workspace documents do not answer this question.',
  groundedness_failed: 'The groundedness check found sentences the cited passages do not support.',
  low_confidence: 'Confidence fell below the review threshold.',
  injection_suspected_in_sources: 'A retrieved passage contained text that looked like an instruction to the agent.',
}

export function flagReasonText(reason: string): string {
  return FLAG_REASONS[reason] ?? reason.replace(/_/g, ' ')
}

/** Opens the document viewer with the exact cited passage highlighted. */
export function passageHref(citation: Pick<Citation, 'document_id' | 'chunk_id'>): string {
  return `/documents/${citation.document_id}?chunk=${citation.chunk_id}`
}

export type AnswerSegment = { kind: 'text'; value: string } | { kind: 'marker'; ordinal: number }

/**
 * Splits an answer into its text and its [n] citation markers. The backend
 * places the markers itself from each sentence's source ids and renumbers them
 * 1..k (backend/app/rag/answer.py), so an ordinal here matches a citation
 * ordinal on the same response.
 */
export function splitAnswer(text: string): AnswerSegment[] {
  // Built per call: a /g regex carries lastIndex between calls.
  const marker = /\[(\d+)\]/g
  const segments: AnswerSegment[] = []
  let cursor = 0

  for (let match = marker.exec(text); match !== null; match = marker.exec(text)) {
    if (match.index > cursor) segments.push({ kind: 'text', value: text.slice(cursor, match.index) })
    segments.push({ kind: 'marker', ordinal: Number(match[1]) })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) })
  return segments
}

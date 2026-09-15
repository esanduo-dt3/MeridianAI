import type { DocumentSummary } from '../lib/types'

/** Short label for where a document is in ingestion (D-034). */
export function stageLabel(doc: DocumentSummary): string {
  if (doc.parsed_status === 'pending') return 'Queued'
  if (doc.processing_stage === 'embedding' && doc.chunk_count > 0) return `Embedding ${doc.embedded_count}/${doc.chunk_count}`
  return 'Reading file'
}

export function embeddingFraction(doc: DocumentSummary): number {
  return doc.chunk_count > 0 ? Math.min(doc.embedded_count / doc.chunk_count, 1) : 0
}

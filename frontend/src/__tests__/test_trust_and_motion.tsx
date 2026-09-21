import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnswerPanel } from '../agent/AnswerPanel'
import type { AskResponse, DocumentDetail } from '../lib/types'
import { DocumentViewer } from '../routes/DocumentViewer'

const trustState = vi.hoisted(() => ({
  reduceMotion: false,
  scrollIntoView: vi.fn(),
}))

const documentFixture: DocumentDetail = {
  id: 'document-1',
  file_name: 'operating-policy.pdf',
  doc_type: 'pdf',
  mime_type: 'application/pdf',
  size_bytes: 4096,
  parsed_status: 'ready',
  processing_stage: null,
  parse_error: null,
  page_count: 1,
  chunk_count: 1,
  embedded_count: 1,
  parse_stats: { tables: 0 },
  created_at: '2026-09-18T10:00:00.000Z',
  processed_at: '2026-09-18T10:01:00.000Z',
  uploaded_by: null,
  content_text: 'The operating policy requires human approval.',
  chunks: [
    {
      id: 'chunk-1',
      chunk_index: 0,
      char_start: 4,
      char_end: 20,
      page: 1,
      section: 'Approval',
      kind: 'text',
      token_count: 8,
      embedded: true,
    },
  ],
}

const answerFixture: AskResponse = {
  answer_id: 'answer-1',
  question: 'What requires review?',
  answer: 'The operating policy requires human approval [1].',
  answerable: true,
  citations: [
    {
      ordinal: 1,
      chunk_id: 'chunk-1',
      document_id: 'document-1',
      file_name: 'operating-policy.pdf',
      char_start: 4,
      char_end: 20,
      page: 1,
      section: 'Approval',
      excerpt: 'operating policy requires human approval',
    },
  ],
  confidence: {
    value: 0.42,
    label: 'uncalibrated',
    basis: 'Combined reranker and grader evidence.',
  },
  grounded: false,
  flagged: true,
  flag_reasons: ['injection_suspected_in_sources'],
  retrieval: {
    run_id: 'run-1',
    attempts: 2,
    grade: 'weak',
    final_query: 'human approval policy',
    top_score: 0.42,
    reranked: true,
    latency_ms: 1250,
  },
  model: 'test-model',
}

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
  return {
    ...actual,
    useReducedMotion: () => trustState.reduceMotion,
  }
})

vi.mock('../documents/useDocuments', () => ({
  useDocument: () => ({
    data: documentFixture,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

function renderDocument() {
  return render(
    <MemoryRouter initialEntries={['/documents/document-1?chunk=chunk-1']}>
      <Routes>
        <Route path="/documents/:documentId" element={<DocumentViewer />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('document citation and motion contracts', () => {
  beforeEach(() => {
    trustState.reduceMotion = false
    trustState.scrollIntoView.mockReset()
    HTMLElement.prototype.scrollIntoView = trustState.scrollIntoView
  })

  it.each([
    [false, 'smooth'],
    [true, 'auto'],
  ])('uses %s reduced-motion preference to select %s passage scrolling', async (reduceMotion, behavior) => {
    trustState.reduceMotion = reduceMotion
    renderDocument()

    expect(screen.getByRole('button', { name: /Passage 1/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('operating policy', { selector: 'mark' })).toBeInTheDocument()
    await waitFor(() =>
      expect(trustState.scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        behavior,
      }),
    )
  })
})

describe('answer trust evidence', () => {
  it('keeps citation, confidence, groundedness, flag reason, and retrieval evidence inspectable', () => {
    render(
      <MemoryRouter>
        <AnswerPanel result={answerFixture} />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Answer')).toBeInTheDocument()
    expect(screen.getByText('0.42')).toBeInTheDocument()
    expect(screen.getByText('uncalibrated')).toBeInTheDocument()
    expect(screen.getByText('Not grounded')).toBeInTheDocument()
    expect(screen.getByText('Flagged for review')).toBeInTheDocument()
    expect(
      screen.getByText('A retrieved passage contained text that looked like an instruction to the agent.'),
    ).toBeInTheDocument()

    const citations = screen.getAllByRole('link', { name: /operating-policy\.pdf/ })
    expect(citations).toHaveLength(2)
    for (const citation of citations) {
      expect(citation).toHaveAttribute('href', '/documents/document-1?chunk=chunk-1')
    }
    expect(screen.getByText('How this answer was retrieved')).toBeInTheDocument()
  })
})

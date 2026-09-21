import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Proposal } from '../lib/types'
import { ProposalsPanel } from '../tasks/ProposalsPanel'

const workspaceState = vi.hoisted(() => ({ isAdmin: true }))

const mutationState = vi.hoisted(() => ({
  approve: { mutate: vi.fn(), isPending: false, variables: undefined as string | undefined },
  reject: { mutate: vi.fn(), isPending: false, variables: undefined as string | undefined },
}))

vi.mock('../workspace/WorkspaceProvider', () => ({
  useWorkspace: () => ({ isAdmin: workspaceState.isAdmin }),
}))

vi.mock('../tasks/useTasks', () => ({
  useTaskMutations: () => ({ approve: mutationState.approve, reject: mutationState.reject }),
}))

function makeProposal(id: string, overrides: Partial<Proposal> = {}): Proposal {
  return {
    id,
    reasoning: `Reasoning for ${id}`,
    proposed_payload: { title: `Proposal ${id}` },
    created_at: '2026-09-18T10:00:00.000Z',
    ...overrides,
  }
}

describe('ProposalsPanel', () => {
  beforeEach(() => {
    workspaceState.isAdmin = true
    mutationState.approve.mutate.mockReset()
    mutationState.approve.isPending = false
    mutationState.approve.variables = undefined
    mutationState.reject.mutate.mockReset()
    mutationState.reject.isPending = false
    mutationState.reject.variables = undefined
  })

  it('returns nothing for an empty array', () => {
    const { container } = render(<ProposalsPanel proposals={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('bounds visible rows to three and reveals the rest on demand', async () => {
    const user = userEvent.setup()
    const proposals = ['a', 'b', 'c', 'd', 'e'].map((id) => makeProposal(id))
    render(<ProposalsPanel proposals={proposals} />)

    expect(screen.getByText('Proposed by the agent · 5')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Why' }).length).toBe(3)

    await user.click(screen.getByRole('button', { name: 'Show all 5' }))
    expect(screen.getAllByRole('button', { name: 'Why' }).length).toBe(5)

    await user.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(screen.getAllByRole('button', { name: 'Why' }).length).toBe(3)
  })

  it('keeps description and reasoning behind a per-row disclosure wired through aria-expanded and aria-controls', async () => {
    const user = userEvent.setup()
    const proposal = makeProposal('a', { proposed_payload: { title: 'Proposal a', description: 'Some description' } })
    render(<ProposalsPanel proposals={[proposal]} />)

    const trigger = screen.getByRole('button', { name: 'Why' })
    expect(trigger).toHaveAttribute('title', 'Why the agent proposed "Proposal a"')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Reasoning for a')).not.toBeInTheDocument()

    const controlsId = trigger.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const region = screen.getByRole('region', { name: 'Why the agent proposed "Proposal a"' })
    expect(region).toHaveAttribute('id', controlsId)
    expect(screen.getByText('Some description')).toBeInTheDocument()
    expect(screen.getByText('Reasoning for a')).toBeInTheDocument()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Reasoning for a')).not.toBeInTheDocument()
  })

  it('keeps Approve and Reject on the collapsed row for Admins only', () => {
    const proposal = makeProposal('a')
    const { rerender } = render(<ProposalsPanel proposals={[proposal]} />)

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(screen.getByText('Nothing is added until you approve it.')).toBeInTheDocument()

    workspaceState.isAdmin = false
    rerender(<ProposalsPanel proposals={[proposal]} />)

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.getByText('Waiting for an Admin to approve or reject.')).toBeInTheDocument()
  })

  it('isolates pending state to the proposal being decided', () => {
    mutationState.approve.isPending = true
    mutationState.approve.variables = 'a'
    const proposals = [makeProposal('a'), makeProposal('b')]
    render(<ProposalsPanel proposals={proposals} />)

    const approveButtons = screen.getAllByRole('button', { name: 'Approve' })
    expect(approveButtons[0]).toHaveAttribute('aria-busy', 'true')
    expect(approveButtons[0]).toBeDisabled()
    expect(approveButtons[1]).not.toHaveAttribute('aria-busy')
    expect(approveButtons[1]).not.toBeDisabled()

    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' })
    expect(rejectButtons[0]).toBeDisabled()
    expect(rejectButtons[1]).not.toBeDisabled()
  })

  it('calls the mutation with the decided proposal id', async () => {
    const user = userEvent.setup()
    const proposals = [makeProposal('a'), makeProposal('b')]
    render(<ProposalsPanel proposals={proposals} />)

    const approveButtons = screen.getAllByRole('button', { name: 'Approve' })
    await user.click(approveButtons[1])
    expect(mutationState.approve.mutate).toHaveBeenCalledWith('b')

    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' })
    await user.click(rejectButtons[0])
    expect(mutationState.reject.mutate).toHaveBeenCalledWith('a')
  })
})

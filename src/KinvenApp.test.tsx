// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import KinvenApp from './KinvenApp'

describe('new task dialog regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  const openNewTask = () => {
    render(<KinvenApp />)
    fireEvent.click(screen.getByRole('button', { name: /new task/i }))
  }

  it('does not show the removed Capture something heading', () => {
    openNewTask()

    expect(screen.getByText('New task', { selector: '.modal .eyebrow' })).toBeInTheDocument()
    expect(screen.queryByText('Capture something')).not.toBeInTheDocument()
  })

  it('creates and selects a group from the group dropdown', () => {
    openNewTask()

    fireEvent.change(screen.getByRole('combobox', { name: 'Group' }), {
      target: { value: '__create__' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'New group name' }), {
      target: { value: 'Regression Group' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }))

    expect(screen.getByRole('combobox', { name: 'Group' })).toHaveValue(
      (screen.getByRole('option', { name: 'Regression Group' }) as HTMLOptionElement).value,
    )
  })
})

describe('theme and header regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('removes the inactive focus pill and persists theme changes', async () => {
    render(<KinvenApp />)

    expect(screen.queryByText('No active focus block')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(localStorage.getItem('kinven-theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })
})

describe('subtask editor regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('adds, edits, completes, and reopens a subtask', () => {
    render(<KinvenApp />)
    fireEvent.click(screen.getByText('Reply to messages'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Add subtask' }), { target: { value: 'Review draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    const title = screen.getByRole('textbox', { name: 'Subtask title' })
    expect(title).toHaveValue('Review draft')
    fireEvent.change(title, { target: { value: 'Review final draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark Review final draft complete' }))
    expect(screen.getByRole('button', { name: 'Mark Review final draft incomplete' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark Review final draft incomplete' }))
    expect(screen.getByRole('button', { name: 'Mark Review final draft complete' })).toBeInTheDocument()
  })
})

describe('hovered task shortcut regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  const renderAndHoverInboxTask = () => {
    render(<KinvenApp />)
    const row = screen.getByText('Reply to messages').closest('[data-task-id]')
    if (!row) throw new Error('Task row not found')
    fireEvent.mouseOver(row)
    return row
  }

  it('uses E and R to complete and reopen the hovered task', () => {
    renderAndHoverInboxTask()
    fireEvent.keyDown(window, { key: 'e' })
    fireEvent.click(screen.getByRole('button', { name: /Completed/ }))
    const completedRow = screen.getByText('Reply to messages').closest('[data-task-id]')!
    expect(completedRow).toHaveClass('done')

    fireEvent.mouseOver(completedRow)
    fireEvent.keyDown(window, { key: 'r' })
    fireEvent.click(screen.getByRole('button', { name: /Inbox/ }))
    expect(screen.getByText('Reply to messages').closest('[data-task-id]')).not.toHaveClass('done')
  })

  it('opens the editor with Enter and blocks unlisted task shortcuts', () => {
    renderAndHoverInboxTask()
    fireEvent.keyDown(window, { key: 'n' })
    expect(screen.queryByText('New task', { selector: '.modal .eyebrow' })).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('Edit task')).toBeInTheDocument()
  })

  it.each([
    ['d', 'Date'],
    ['o', 'Group'],
    ['s', 'Add subtask'],
  ])('focuses %s task editing with Command shortcut', async (key, accessibleName) => {
    renderAndHoverInboxTask()
    fireEvent.keyDown(window, { key, metaKey: true })

    await waitFor(() => expect(screen.getByLabelText(accessibleName)).toHaveFocus())
  })

  it('asks for confirmation before deleting the hovered task', () => {
    renderAndHoverInboxTask()
    fireEvent.keyDown(window, { key: 'Delete' })

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete “Reply to messages”?')
    expect(screen.getByText('Reply to messages')).toBeInTheDocument()
  })
})

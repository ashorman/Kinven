// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KinvenApp from './KinvenApp'

const sidebar = () => document.querySelector('.sidebar') as HTMLElement

// The sidebar retargets the calendar planning pane, so reach full lists via the Tasks tab.
const openList = (name: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))
  fireEvent.click(within(sidebar()).getByRole('button', { name }))
}

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
    fireEvent.click(within(document.querySelector<HTMLElement>('.modal')!).getByRole('button', { name: 'Create group' }))

    expect(screen.getByRole('combobox', { name: 'Group' })).toHaveValue(
      (screen.getByRole('option', { name: 'Regression Group' }) as HTMLOptionElement).value,
    )
  })
})

describe('identity regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('shows the Kinven brand and migrates legacy storage keys', () => {
    localStorage.setItem('aftertone-local-v1', JSON.stringify({
      tasks: [{ id: 'legacy-task', title: 'Legacy task', notes: '', groupId: null, date: null, startMinutes: 540, duration: 30, completed: false, repeat: 'none', createdAt: 1 }],
      groups: [{ id: 'legacy-group', title: 'Legacy group', color: '#7c6cf2' }],
    }))
    localStorage.setItem('aftertone-theme', 'light')

    render(<KinvenApp />)

    expect(screen.getByLabelText('Kinven')).toHaveTextContent('Kinven')
    expect(screen.getByText('Legacy task')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('kinven-theme')).toBe('light')
  })

  it('ignores task-shaped data and themes from unrelated storage keys', () => {
    localStorage.setItem('other-app-state', JSON.stringify({
      tasks: [{ id: 'foreign-task', title: 'Foreign task', notes: '', groupId: null, date: null, startMinutes: 540, duration: 30, completed: false, repeat: 'none', createdAt: 1 }],
      groups: [{ id: 'foreign-group', title: 'Foreign group', color: '#7c6cf2' }],
    }))
    localStorage.setItem('other-app-theme', 'light')

    render(<KinvenApp />)

    expect(screen.queryByText('Foreign task')).not.toBeInTheDocument()
    expect(screen.getByText('Reply to messages')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('theme and header regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('removes the inactive focus pill and persists theme changes', async () => {
    render(<KinvenApp />)

    expect(screen.queryByText('No active focus block')).not.toBeInTheDocument()
    expect(document.querySelector('.traffic-lights')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(localStorage.getItem('kinven-theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()

    openList(/^today$/i)
    expect(screen.getByPlaceholderText(/type tasks separated by semicolons/i)).toBeInTheDocument()
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

describe('task creation regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('shows unscheduled quick-add tasks immediately on Today', () => {
    render(<KinvenApp />)
    openList(/^today$/i)
    fireEvent.change(screen.getByPlaceholderText(/type tasks separated by semicolons/i), { target: { value: 'Today capture' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/type tasks separated by semicolons/i), { key: 'Enter' })

    expect(screen.getByText('Today capture')).toBeInTheDocument()
    expect(screen.getAllByText('Unscheduled', { selector: '.schedule-badge' }).length).toBeGreaterThan(0)
  })
})

describe('search regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('shows global search results regardless of the active sidebar filter', () => {
    render(<KinvenApp />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search tasks' }), { target: { value: 'Reply' } })
    fireEvent.click(within(sidebar()).getByRole('button', { name: /^today$/i }))

    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByText('Reply to messages')).toBeInTheDocument()
    expect(screen.getByText(/showing matches across all tasks/i)).toBeInTheDocument()
  })
})

describe('task list regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('shows one completion control per task until select mode is enabled', () => {
    render(<KinvenApp />)
    openList(/^today$/i)

    document.querySelectorAll('.list-view .task-row').forEach((row) => {
      expect(row.querySelectorAll('.check-button')).toHaveLength(1)
      expect(row.parentElement?.querySelector('.select-box')).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(screen.getByText('Tap tasks to select them, then use the actions above.')).toBeInTheDocument()
  })

  it('groups mixed group views into scheduled and unscheduled sections', () => {
    render(<KinvenApp />)
    openList(/deep work/i)

    expect(screen.getByRole('heading', { name: 'Scheduled' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Unscheduled' })).toBeInTheDocument()
    expect(screen.getAllByText('Unscheduled', { selector: '.schedule-badge' }).length).toBeGreaterThan(0)
  })

  it('batch assigns a group in select mode', () => {
    render(<KinvenApp />)
    openList(/deep work/i)

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByText('Outline next milestone'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Group' }), { target: { value: 'health' } })

    expect(screen.queryByText('Outline next milestone')).not.toBeInTheDocument()
    fireEvent.click(within(sidebar()).getByRole('button', { name: /health/i }))
    expect(screen.getByText('Outline next milestone')).toBeInTheDocument()
  })

  it('deletes all completed tasks from the completed view', () => {
    render(<KinvenApp />)

    fireEvent.click(screen.getByRole('button', { name: 'Mark Reply to messages complete' }))
    openList(/completed/i)
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete all' }))

    expect(screen.queryByText('Reply to messages')).not.toBeInTheDocument()
  })

  it('keeps scheduled tasks off the calendar planning inbox', () => {
    render(<KinvenApp />)
    const planningPane = document.querySelector<HTMLElement>('.planning-pane')!

    expect(within(planningPane).getByText('Reply to messages')).toBeInTheDocument()
    expect(within(planningPane).queryByText('Plan the day')).not.toBeInTheDocument()
    expect(screen.getByText('Unscheduled tasks only. Drag onto the calendar to schedule.')).toBeInTheDocument()
  })
})

describe('calendar planning pane filter regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('retargets the planning pane without leaving the calendar', () => {
    render(<KinvenApp />)
    fireEvent.click(within(sidebar()).getByRole('button', { name: /upcoming/i }))

    const pane = document.querySelector<HTMLElement>('.planning-pane')!
    expect(document.querySelector('.calendar-view')).toBeInTheDocument()
    expect(within(pane).getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument()
    expect(within(pane).queryByText('Reply to messages')).not.toBeInTheDocument()
    expect(screen.getByText(/Showing Upcoming\. Drag any task onto the calendar/i)).toBeInTheDocument()
  })

  it('expands the current pane filter into the full list', () => {
    render(<KinvenApp />)
    fireEvent.click(within(sidebar()).getByRole('button', { name: /upcoming/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Open full list' }))

    expect(document.querySelector('.calendar-view')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument()
  })
})

describe('delete confirmation keyboard regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  const openDeleteConfirm = () => {
    render(<KinvenApp />)
    fireEvent.mouseMove(screen.getByText('Reply to messages'))
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  }

  it('deletes the task when Enter is pressed', () => {
    openDeleteConfirm()
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Reply to messages')).not.toBeInTheDocument()
  })

  it('cancels when Escape is pressed', () => {
    openDeleteConfirm()
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('Reply to messages')).toBeInTheDocument()
  })
})

describe('inbox scheduling clarity regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('explains that inbox only holds unscheduled tasks', () => {
    render(<KinvenApp />)
    openList(/inbox/i)

    expect(screen.getByText(/Inbox holds unscheduled tasks only/i)).toBeInTheDocument()
    expect(screen.getByText(/moves to Today, Upcoming, and the calendar/i)).toBeInTheDocument()
  })
})

describe('calendar current-time regressions', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 10, 20, 59))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('marks late evening times now that the grid covers 24 hours', () => {
    render(<KinvenApp />)

    const nowLine = screen.getByTestId('now-line')
    expect(nowLine.closest('.day-column')).toHaveAttribute('data-date', '2026-09-10')
    expect(parseFloat(nowLine.style.top)).toBeCloseTo(((20 * 60 + 59) / 1440) * 100, 1)
    expect(screen.getByText('8:59', { selector: '.now-label' })).toBeInTheDocument()
  })

  it('renders a full midnight-to-midnight hour gutter', () => {
    render(<KinvenApp />)
    const labels = Array.from(document.querySelectorAll('.hours span')).map((node) => node.textContent)

    expect(labels).toHaveLength(24)
    expect(labels[0]).toBe('12 AM')
    expect(labels[23]).toBe('11 PM')
  })

  it('emphasises today over past days', () => {
    render(<KinvenApp />)

    expect(document.querySelector('.day-column.today')).toHaveAttribute('data-date', '2026-09-10')
    expect(document.querySelector('.day-column.past')).toHaveAttribute('data-date', '2026-09-07')
  })
})

describe('planning quick add regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('keeps the N shortcut working without showing a badge in the field', () => {
    render(<KinvenApp />)
    expect(document.querySelector('.planning-pane kbd')).toBeNull()

    fireEvent.keyDown(window, { key: 'n' })
    expect(screen.getByText('New task', { selector: '.modal .eyebrow' })).toBeInTheDocument()
  })
})

describe('search dismissal regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('keeps typing focus in the search box when results replace the calendar', () => {
    render(<KinvenApp />)
    const searchInput = screen.getByRole('textbox', { name: 'Search tasks' })
    searchInput.focus()
    fireEvent.change(searchInput, { target: { value: 'Reply' } })

    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument()
    expect(searchInput).toHaveFocus()
  })

  it('returns to the previous view as soon as the search box is emptied', () => {
    render(<KinvenApp />)
    const searchInput = screen.getByRole('textbox', { name: 'Search tasks' })
    fireEvent.change(searchInput, { target: { value: 'Reply' } })
    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.queryByRole('heading', { name: 'Search' })).not.toBeInTheDocument()
    expect(document.querySelector('.calendar-view')).toBeInTheDocument()
  })
})

describe('sidebar typography regressions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('keeps nav items larger than the new-task button and readable in light theme', async () => {
    render(<KinvenApp />)
    const inbox = within(sidebar()).getByRole('button', { name: /inbox/i })
    const newTask = within(sidebar()).getByRole('button', { name: /new task/i })

    expect(inbox).toHaveClass('sidebar-button')
    expect(newTask).toHaveClass('sidebar-new')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))

    expect(inbox).toBeVisible()
    expect(newTask).toBeVisible()
  })
})

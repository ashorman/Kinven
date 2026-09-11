import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  Archive, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Circle, Clock3, Inbox, Maximize2, Moon, MoreHorizontal, Plus, Repeat2, Search,
  Sparkles, Sun, Trash2, X,
} from 'lucide-react'
import {
  addDays, addMonths, addWeeks, addYears, eachDayOfInterval, endOfMonth,
  differenceInCalendarDays, format, isToday, parseISO, startOfMonth, startOfWeek,
} from 'date-fns'
import './Kinven.css'

type RepeatRule = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'
type CalendarRange = 1 | 3 | 5 | 7 | 'month'
type View = 'calendar' | 'inbox' | 'today' | 'upcoming' | 'completed' | 'incomplete' | `group:${string}`
type ListFilter = Exclude<View, 'calendar'>
type Task = {
  id: string; title: string; notes: string; groupId: string | null
  date: string | null; startMinutes: number; duration: number
  completed: boolean; repeat: RepeatRule; createdAt: number
  subtasks?: { id: string; title: string; completed: boolean }[]
  seriesId?: string
  seriesRepeat?: RepeatRule
}
type Group = { id: string; title: string; color: string }
type RecurrenceScope = 'only' | 'past' | 'future' | 'all'
type TaskEditSection = 'general' | 'date' | 'group' | 'subtasks'
type PendingSeriesAction =
  | { kind: 'edit'; original: Task; next: Task }
  | { kind: 'delete'; task: Task }

const COLORS = ['#7c6cf2', '#ef6262', '#f59e4a', '#8db83f', '#42a5d9', '#d96fbd']
const STORE = 'kinven-local-v1'
const THEME_STORE = 'kinven-theme'
const LEGACY_STORE = 'aftertone-local-v1'
const LEGACY_THEME = 'aftertone-theme'
const DAY_MINUTES = 1440
const GRID_HEIGHT = 1440
const minutesToOffset = (minutes: number) => (minutes / DAY_MINUTES) * 100
const offsetToMinutes = (ratio: number) => Math.round((ratio * DAY_MINUTES) / 15) * 15
const todayKey = () => format(new Date(), 'yyyy-MM-dd')
const uid = () => crypto.randomUUID()
const dateToKey = (date: Date) => format(date, 'yyyy-MM-dd')
const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const seedGroups: Group[] = [
  { id: 'deep', title: 'Deep work', color: '#7c6cf2' },
  { id: 'health', title: 'Health', color: '#8db83f' },
  { id: 'admin', title: 'Admin', color: '#f59e4a' },
]
const seedTasks: Task[] = [
  { id: uid(), title: 'Plan the day', notes: 'Choose the three outcomes that matter most.', groupId: 'deep', date: todayKey(), startMinutes: 540, duration: 30, completed: false, repeat: 'weekdays', createdAt: Date.now() },
  { id: uid(), title: 'Coffee, stretch, walk or swim', notes: '', groupId: 'health', date: todayKey(), startMinutes: 480, duration: 60, completed: false, repeat: 'daily', createdAt: Date.now() },
  { id: uid(), title: 'Review project notes', notes: '', groupId: 'deep', date: todayKey(), startMinutes: 660, duration: 60, completed: false, repeat: 'none', createdAt: Date.now() },
  { id: uid(), title: 'Reply to messages', notes: '', groupId: 'admin', date: null, startMinutes: 540, duration: 30, completed: false, repeat: 'none', createdAt: Date.now() },
  { id: uid(), title: 'Outline next milestone', notes: '', groupId: 'deep', date: null, startMinutes: 540, duration: 60, completed: false, repeat: 'none', createdAt: Date.now() },
]
const SHORTCUT_GROUPS = [
  { title: 'Global', items: [['Double ⌘', 'Universal Capture'], ['⌘ I', 'Auto Capture'], ['⌘ K', 'Command palette'], ['Tab', 'Calendar / Focus Mode'], ['⌘ Z', 'Undo'], ['⌘ P', 'Auto Plan'], ['⌘ ⇧ P', 'Auto Schedule']] },
  { title: 'Tasks & calendar', items: [['N', 'New task'], ['⌘ N', 'Schedule new task'], ['P', 'Plan selected task'], ['S', 'Schedule selected task'], ['E', 'Edit selected task'], ['/', 'Actions'], ['⌫', 'Delete'], ['J / K', 'Next / previous task'], ['⌘ ↑ / ↓', 'Reorder task'], ['⌘ D', 'Set date'], ['1 / 2 / 3 / 4', 'Inbox / Today / Upcoming / Completed'], ['5', 'Planning view'], ['R', 'Incomplete'], ['⌘ F', 'Filter'], ['O / G', 'Groups'], ['⌘ 1 / 3 / 7 / 0', 'Calendar range'], ['⌘ C / V', 'Copy / paste task'], ['⌘ + / −', 'Calendar zoom']] },
  { title: 'Smart Zoning', items: [['⇧ →', 'Place selected task'], ['↑ / ↓', 'Move time'], ['← / →', 'Move day'], ['⌘ ↑ / ↓', 'Shorten / extend'], ['Enter', 'Confirm'], ['Esc', 'Cancel']] },
  { title: 'Focus Mode', items: [['E', 'Complete'], ['⌘ E', 'Complete now'], ['⌘ S', 'Add subtask'], ['A', 'Auto-Extend'], ['B', 'Take a break'], ['+ / −', 'Extend / shorten'], ['/', 'Actions'], ['Enter', 'Edit'], ['⌘ J', 'Open notes'], ['⌫', 'Delete']] },
] as const

function nextRepeatDate(task: Task) {
  const repeat = task.seriesRepeat || task.repeat
  if (!task.date || repeat === 'none') return null
  let next = parseISO(task.date)
  if (repeat === 'daily') next = addDays(next, 1)
  if (repeat === 'weekly') next = addWeeks(next, 1)
  if (repeat === 'monthly') next = addMonths(next, 1)
  if (repeat === 'yearly') next = addYears(next, 1)
  if (repeat === 'weekdays') {
    next = addDays(next, 1)
    while ([0, 6].includes(next.getDay())) next = addDays(next, 1)
  }
  return dateToKey(next)
}

function seriesSignature(task: Task) {
  return `${task.title}::${task.groupId || ''}::${task.startMinutes}::${task.duration}`
}

function sameSeries(a: Task, b: Task) {
  if (a.seriesId && b.seriesId) return a.seriesId === b.seriesId
  return seriesSignature(a) === seriesSignature(b)
    && (a.repeat !== 'none' || b.repeat !== 'none' || !!a.seriesId || !!b.seriesId)
}

function toSeriesInstance(task: Task, seriesId: string, seriesRepeat: RepeatRule): Task {
  return { ...task, seriesId, seriesRepeat, repeat: 'none' }
}

export function expandRecurrences(task: Task) {
  const seriesRepeat = task.seriesRepeat || task.repeat
  if (!task.date || seriesRepeat === 'none') return [task]
  const seriesId = task.seriesId || uid()
  const first = toSeriesInstance({ ...task, completed: task.completed }, seriesId, seriesRepeat)
  const instances = [first]
  let cursor = first
  const horizon = addMonths(parseISO(task.date), 3)
  for (let index = 0; index < 100; index += 1) {
    const date = nextRepeatDate(cursor)
    if (!date || parseISO(date) > horizon) break
    cursor = { ...first, date }
    instances.push({ ...cursor, id: uid(), completed: false, createdAt: Date.now() + index + 1 })
  }
  return instances
}

export function completeTasksById(tasks: Task[], id: string, complete = true) {
  if (!tasks.some((task) => task.id === id)) return tasks
  return tasks.map((task) => task.id === id ? { ...task, completed: complete } : task)
}

export function matchesTaskView(task: Task, view: View, completedTasks: Task[] = []) {
  if (view === 'completed') return completedTasks.some((item) => item.id === task.id)
  if (task.completed) return false
  if (view === 'inbox') return !task.date
  if (view === 'today') return !task.date || task.date === todayKey()
  if (view === 'upcoming') return !!task.date && task.date > todayKey()
  if (view === 'incomplete') return true
  if (view.startsWith('group:')) return task.groupId === view.slice(6)
  return true
}

function sortTasksForView(items: Task[], view: View) {
  const sortKey = (task: Task) => !task.date && view === 'today' ? '0000' : task.date || '9999'
  return [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.startMinutes - b.startMinutes)
}

export function tasksForFilter(tasks: Task[], filter: View, completedTasks: Task[]) {
  const matched = filter === 'completed'
    ? completedTasks
    : tasks.filter((task) => matchesTaskView(task, filter, completedTasks))
  return sortTasksForView(matched, filter)
}

export function collapseCompletedTasks(tasks: Task[]) {
  const completed = tasks.filter((task) => task.completed)
  const seriesBest = new Map<string, Task>()
  const standalone: Task[] = []
  for (const task of completed) {
    if (task.seriesId) {
      const existing = seriesBest.get(task.seriesId)
      if (!existing || (task.date || '').localeCompare(existing.date || '') > 0) seriesBest.set(task.seriesId, task)
      continue
    }
    standalone.push(task)
  }
  return [...standalone, ...seriesBest.values()]
}

export function tasksMatchingSeriesScope(tasks: Task[], base: Task, scope: RecurrenceScope) {
  const baseOrder = base.date || String(base.createdAt)
  return tasks.filter((task) => {
    if (scope === 'only') return task.id === base.id
    if (!sameSeries(task, base)) return false
    const taskOrder = task.date || String(task.createdAt)
    if (scope === 'past') return taskOrder <= baseOrder
    if (scope === 'future') return taskOrder >= baseOrder
    return true
  })
}

function normalizeRecurringTasks(tasks: Task[]) {
  const migrated = tasks.map((task) => {
    if (!task.seriesId || task.repeat === 'none') return task
    return { ...task, seriesRepeat: task.seriesRepeat || task.repeat, repeat: 'none' as RepeatRule }
  })
  const expanded = migrated.flatMap((task) => task.repeat !== 'none' && !task.seriesId ? expandRecurrences(task) : [task])
  const seenIds = new Set<string>()
  const seenOccurrences = new Set<string>()
  return expanded.filter((task) => {
    if (seenIds.has(task.id)) return false
    seenIds.add(task.id)
    const occurrenceKey = `${task.seriesId || seriesSignature(task)}:${task.date || 'inbox'}`
    if (seenOccurrences.has(occurrenceKey)) return false
    seenOccurrences.add(occurrenceKey)
    return true
  })
}

export default function KinvenApp() {
  const stored = useMemo(() => {
    try {
      const current = localStorage.getItem(STORE) || localStorage.getItem(LEGACY_STORE)
      if (current) return JSON.parse(current)
      for (let index = 0; index < localStorage.length; index += 1) {
        const candidate = localStorage.getItem(localStorage.key(index) || '')
        if (!candidate) continue
        const parsed = JSON.parse(candidate)
        if (Array.isArray(parsed?.tasks) && Array.isArray(parsed?.groups)) return parsed
      }
      return null
    } catch { return null }
  }, [])
  const initialTasks = useMemo(() => normalizeRecurringTasks(stored?.tasks ?? seedTasks), [stored])
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [groups, setGroups] = useState<Group[]>(stored?.groups ?? seedGroups)
  const [view, setView] = useState<View>('calendar')
  const [range, setRange] = useState<CalendarRange>(5)
  const [anchor, setAnchor] = useState(new Date())
  const [quickTitle, setQuickTitle] = useState('')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [creatingTask, setCreatingTask] = useState<Partial<Task> | null>(null)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [focusSubtask, setFocusSubtask] = useState(false)
  const [autoExtend, setAutoExtend] = useState(false)
  const [commandPalette, setCommandPalette] = useState(false)
  const [shortcutHelp, setShortcutHelp] = useState(false)
  const [toast, setToast] = useState('')
  const [calendarZoom, setCalendarZoom] = useState(1)
  const [pendingSeriesAction, setPendingSeriesAction] = useState<PendingSeriesAction | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const current = localStorage.getItem(THEME_STORE) || localStorage.getItem(LEGACY_THEME)
    if (current === 'light' || current === 'dark') return current
    for (let index = 0; index < localStorage.length; index += 1) {
      const value = localStorage.getItem(localStorage.key(index) || '')
      if (value === 'light' || value === 'dark') return value
    }
    return 'dark'
  })
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<TaskEditSection>('general')
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [deletingAllCompleted, setDeletingAllCompleted] = useState(false)
  const [paneFilter, setPaneFilter] = useState<ListFilter>('inbox')
  const copiedTask = useRef<Task | null>(null)
  const zoning = useRef<{ task: Task } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastMetaTap = useRef(0)
  const undoStack = useRef<{ tasks: Task[]; groups: Group[] }[]>([])
  const previousState = useRef(JSON.stringify({ tasks: initialTasks, groups: stored?.groups ?? seedGroups }))
  const undoing = useRef(false)

  useEffect(() => {
    const next = JSON.stringify({ tasks, groups })
    if (!undoing.current && next !== previousState.current) {
      undoStack.current.push(JSON.parse(previousState.current))
      if (undoStack.current.length > 40) undoStack.current.shift()
    }
    previousState.current = next
    localStorage.setItem(STORE, next)
  }, [tasks, groups])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_STORE, theme)
  }, [theme])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    setSelected(new Set())
    setSelectionMode(false)
  }, [view])
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const inboxTasks = tasks.filter((task) => !task.date && !task.completed)
  const completedTasks = useMemo(() => collapseCompletedTasks(tasks), [tasks])
  const searchQuery = search.trim().toLowerCase()
  const searchActive = searchQuery.length > 0
  const visibleTasks = useMemo(() => {
    if (searchQuery) return sortTasksForView(tasks.filter((task) => task.title.toLowerCase().includes(searchQuery)), view)
    return tasksForFilter(tasks, view, completedTasks)
  }, [tasks, view, searchQuery, completedTasks])
  const paneTasks = useMemo(() => tasksForFilter(tasks, paneFilter, completedTasks), [tasks, paneFilter, completedTasks])
  const filterLabel = (filter: ListFilter) => filter.startsWith('group:')
    ? groupMap.get(filter.slice(6))?.title || 'Group'
    : filter[0].toUpperCase() + filter.slice(1)
  const paneLabel = filterLabel(paneFilter)
  // On the calendar the sidebar retargets the planning pane; elsewhere it navigates.
  const activeFilter: ListFilter = view === 'calendar' ? paneFilter : view
  const selectFilter = (filter: ListFilter) => view === 'calendar' ? setPaneFilter(filter) : setView(filter)
  const calendarDays = useMemo(() => {
    if (range === 'month') {
      const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
      const end = addDays(startOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 6)
      return eachDayOfInterval({ start, end })
    }
    const start = range === 1 || range === 3 ? anchor : startOfWeek(anchor, { weekStartsOn: 1 })
    return Array.from({ length: range }, (_, i) => addDays(start, i))
  }, [anchor, range])

  const updateTask = (next: Task) => setTasks((items) => items.map((item) => item.id === next.id ? next : item))
  const completeTask = (id: string, complete = true) => {
    setTasks((items) => completeTasksById(items, id, complete))
    setToast(complete ? 'Moved to Completed' : 'Marked incomplete')
  }
  const removeTask = useCallback((id: string) => {
    const task = tasks.find((item) => item.id === id)
    if (!task) return
    if (tasks.some((item) => item.id !== id && sameSeries(item, task))) {
      setPendingSeriesAction({ kind: 'delete', task })
      return
    }
    setTasks((items) => items.filter((item) => item.id !== id))
    setEditingTask(null)
  }, [tasks])
  const applySeriesAction = (scope: RecurrenceScope) => {
    if (!pendingSeriesAction) return
    const action = pendingSeriesAction
    const base = action.kind === 'edit' ? action.original : action.task
    setTasks((items) => {
      const targets = tasksMatchingSeriesScope(items, base, scope)
      const targetIds = new Set(targets.map((task) => task.id))
      if (action.kind === 'delete') return items.filter((task) => !targetIds.has(task.id))
      const { original, next } = action
      const dateShift = original.date && next.date
        ? differenceInCalendarDays(parseISO(next.date), parseISO(original.date))
        : 0
      return items.map((task) => {
        if (!targetIds.has(task.id)) return task
        if (scope === 'only') return next.repeat === 'none' ? { ...next, seriesId: undefined, seriesRepeat: undefined } : next
        const shiftedDate = next.date === null
          ? null
          : task.date ? dateToKey(addDays(parseISO(task.date), dateShift)) : next.date
        return {
          ...task,
          title: next.title,
          notes: next.notes,
          groupId: next.groupId,
          date: shiftedDate,
          startMinutes: next.startMinutes,
          duration: next.duration,
          repeat: next.repeat,
          subtasks: next.subtasks,
          seriesId: next.repeat === 'none' ? undefined : task.seriesId,
          seriesRepeat: next.repeat === 'none' ? undefined : task.seriesRepeat,
        }
      })
    })
    setPendingSeriesAction(null)
    setEditingTask(null)
    setCreatingTask(null)
    setDeletingTask(null)
    setToast(action.kind === 'delete' ? 'Recurring tasks deleted' : 'Recurring tasks updated')
  }
  const createQuickTask = () => {
    if (!quickTitle.trim()) return
    const titles = quickTitle.split(';').map((title) => title.trim()).filter(Boolean)
    const groupId = view.startsWith('group:') ? view.slice(6) : null
    const date = view === 'upcoming' ? dateToKey(addDays(new Date(), 1)) : null
    setTasks((items) => [...items, ...titles.map((title) => ({
      id: uid(), title, notes: '', groupId, date, startMinutes: 540, duration: 30,
      completed: false, repeat: 'none' as RepeatRule, createdAt: Date.now(),
    }))])
    setQuickTitle('')
  }
  const deleteGroup = (id: string) => {
    setTasks((items) => items.map((task) => task.groupId === id ? { ...task, groupId: null, date: null } : task))
    setGroups((items) => items.filter((group) => group.id !== id))
    setEditingGroup(null)
    if (view === `group:${id}`) setView('inbox')
  }
  const toggleSelected = (id: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const batch = (action: 'complete' | 'incomplete' | 'delete' | 'inbox' | 'group', groupId?: string | null) => {
    if (action === 'delete') {
      const selectedList = tasks.filter((task) => selected.has(task.id))
      if (selectedList.length === 1 && selectedList.some((task) => task.seriesId || task.seriesRepeat)) {
        setPendingSeriesAction({ kind: 'delete', task: selectedList[0] })
        return
      }
      const idsToDelete = new Set<string>()
      selectedList.forEach((task) => {
        if (task.seriesId) tasks.filter((item) => item.seriesId === task.seriesId).forEach((item) => idsToDelete.add(item.id))
        else idsToDelete.add(task.id)
      })
      setTasks((items) => items.filter((task) => !idsToDelete.has(task.id)))
      setSelected(new Set())
      setToast('Tasks deleted')
      return
    }
    setTasks((items) => items.map((task) => {
      if (!selected.has(task.id)) return task
      if (action === 'complete') return { ...task, completed: true }
      if (action === 'incomplete') return { ...task, completed: false }
      if (action === 'inbox') return { ...task, date: null }
      if (action === 'group') return { ...task, groupId: groupId ?? null }
      return task
    }))
    setSelected(new Set())
    setToast(action === 'group' ? 'Group updated' : 'Tasks updated')
  }
  const deleteAllCompleted = () => {
    setTasks((items) => items.filter((task) => !task.completed))
    setSelected(new Set())
    setSelectionMode(false)
    setDeletingAllCompleted(false)
    setToast('Completed tasks deleted')
  }
  const openScheduledTask = (date: Date, startMinutes = 540) =>
    setCreatingTask({ date: dateToKey(date), startMinutes, duration: 30 })
  const scheduleDroppedTask = (taskId: string, day: Date, clientY: number, rect: DOMRect) => {
    const raw = offsetToMinutes((clientY - rect.top) / rect.height)
    const snapped = Math.max(0, Math.min(DAY_MINUTES - 15, raw))
    setTasks((items) => items.map((task) => task.id === taskId
      ? { ...task, date: dateToKey(day), startMinutes: snapped } : task))
  }
  const now = new Date().getHours() * 60 + new Date().getMinutes()
  const nowTask = tasks.find((t) => t.date === todayKey() && !t.completed && now >= t.startMinutes && now < t.startMinutes + t.duration)
  const focusTask = nowTask || tasks
    .filter((task) => !task.completed)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.startMinutes - b.startMinutes)[0]
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null
  const hoveredTask = tasks.find((task) => task.id === hoveredTaskId) || null

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (event.key === 'Meta' && !event.repeat) {
        const elapsed = Date.now() - lastMetaTap.current
        if (elapsed > 70 && elapsed < 450) {
          event.preventDefault()
          setCreatingTask({})
          setToast('Universal Capture')
          lastMetaTap.current = 0
        } else lastMetaTap.current = Date.now()
        return
      }
      if (deletingTask || deletingAllCompleted) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setDeletingTask(null)
          setDeletingAllCompleted(false)
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          if (deletingTask) {
            const taskId = deletingTask.id
            setDeletingTask(null)
            removeTask(taskId)
          } else deleteAllCompleted()
          return
        }
        return
      }
      if (event.key === 'Escape') {
        if (zoning.current) {
          updateTask(zoning.current.task)
          zoning.current = null
          setToast('Placement cancelled')
        }
        setEditingTask(null); setCreatingTask(null); setEditingGroup(null); setEditingSection('general')
        setCommandPalette(false); setShortcutHelp(false); setFocusSubtask(false); setPendingSeriesAction(null)
        return
      }
      if (mod && key === 'k') {
        event.preventDefault()
        setCommandPalette((open) => !open)
        return
      }
      if (mod && key === 'z' && !typing) {
        event.preventDefault()
        const snapshot = undoStack.current.pop()
        if (snapshot) {
          undoing.current = true
          setTasks(snapshot.tasks); setGroups(snapshot.groups)
          window.setTimeout(() => { undoing.current = false }, 0)
          setToast('Undone')
        }
        return
      }
      if (typing || editingTask || creatingTask || editingGroup || commandPalette || shortcutHelp) return
      if (hoveredTask && !focusMode) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          setDeletingTask(hoveredTask)
          return
        }
        if (!mod && key === 'e') {
          event.preventDefault()
          completeTask(hoveredTask.id, true)
          return
        }
        if (!mod && key === 'r') {
          event.preventDefault()
          completeTask(hoveredTask.id, false)
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          setEditingSection('general')
          setEditingTask(hoveredTask)
          return
        }
        if (mod && ['d', 'o', 's'].includes(key)) {
          event.preventDefault()
          setEditingSection(key === 'd' ? 'date' : key === 'o' ? 'group' : 'subtasks')
          setEditingTask(hoveredTask)
          return
        }
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        setFocusMode((focused) => !focused)
        return
      }

      if (focusMode && focusTask) {
        if (mod && key === 's') { event.preventDefault(); setFocusSubtask(true); return }
        if (mod && key === 'e') {
          event.preventDefault()
          const elapsed = Math.max(15, now - focusTask.startMinutes)
          updateTask({ ...focusTask, duration: elapsed })
          completeTask(focusTask.id)
          setToast('Completed now')
          return
        }
        if (mod && key === 'j') { event.preventDefault(); setEditingTask(focusTask); return }
        if (key === 'e') { event.preventDefault(); completeTask(focusTask.id); setToast('Task completed'); return }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); updateTask({ ...focusTask, duration: focusTask.duration + 15 }); setToast('Extended 15 minutes'); return }
        if (event.key === '-') { event.preventDefault(); updateTask({ ...focusTask, duration: Math.max(15, focusTask.duration - 15) }); setToast('Shortened 15 minutes'); return }
        if (key === 'a') { setAutoExtend((enabled) => !enabled); setToast(autoExtend ? 'Auto-Extend off' : 'Auto-Extend on'); return }
        if (key === 'b') {
          const breakStart = focusTask.startMinutes + focusTask.duration
          setTasks((items) => [...items, { id: uid(), title: 'Break', notes: '', groupId: null, date: todayKey(), startMinutes: breakStart, duration: 15, completed: false, repeat: 'none', createdAt: Date.now() }])
          setToast('15-minute break added')
          return
        }
        if (event.key === 'Enter') { setEditingTask(focusTask); return }
        if (event.key === '/' ) { setCommandPalette(true); return }
        if (event.key === 'Backspace') { event.preventDefault(); removeTask(focusTask.id); setFocusMode(false); return }
      }

      const keyboardTasks = view === 'calendar'
        ? [...inboxTasks, ...tasks.filter((task) => !!task.date && !task.completed)]
        : visibleTasks
      const current = tasks.find((task) => task.id === activeTaskId) || keyboardTasks[0]

      if (zoning.current && current) {
        if (event.key === 'Enter') { zoning.current = null; setToast('Task scheduled'); return }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          const delta = mod ? (event.key === 'ArrowDown' ? 15 : -15) : (event.key === 'ArrowDown' ? 15 : -15)
          if (mod) updateTask({ ...current, duration: Math.max(15, current.duration + delta) })
          else updateTask({ ...current, startMinutes: Math.max(0, Math.min(DAY_MINUTES - 15, current.startMinutes + delta)) })
          return
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          const date = parseISO(current.date || todayKey())
          updateTask({ ...current, date: dateToKey(addDays(date, event.key === 'ArrowRight' ? 1 : -1)) })
          return
        }
      }

      if (mod && key === 'i') { event.preventDefault(); setCreatingTask({}); setToast('Auto Capture ready'); return }
      if (mod && key === 'n') { event.preventDefault(); setCreatingTask({ date: todayKey(), startMinutes: Math.ceil(now / 15) * 15 }); return }
      if (mod && key === 'p') {
        event.preventDefault()
        if (event.shiftKey) {
          let cursor = 540
          setTasks((items) => items.map((task) => {
            if (task.date !== todayKey() || task.completed) return task
            const scheduled = { ...task, startMinutes: cursor }
            cursor += task.duration
            return scheduled
          }))
          setToast('Today auto-scheduled')
        } else {
          setTasks((items) => items.map((task, index) => !task.date && !task.completed
            ? { ...task, date: dateToKey(addDays(new Date(), Math.floor(index / 4))), startMinutes: 540 + (index % 4) * 90 }
            : task))
          setToast('Inbox auto-planned')
        }
        return
      }
      if (mod && ['0', '1', '3', '7'].includes(key)) {
        event.preventDefault()
        setView('calendar')
        setRange(key === '0' ? 'month' : Number(key) as CalendarRange)
        return
      }
      if (mod && key === 'f') { event.preventDefault(); searchRef.current?.focus(); return }
      if (mod && key === 'c' && current) { event.preventDefault(); copiedTask.current = current; setToast('Task copied'); return }
      if (mod && key === 'v' && copiedTask.current) {
        event.preventDefault()
        setTasks((items) => [...items, { ...copiedTask.current!, id: uid(), title: `${copiedTask.current!.title} copy`, completed: false, createdAt: Date.now() }])
        setToast('Task pasted')
        return
      }
      if (mod && (event.key === '+' || event.key === '=')) { event.preventDefault(); setCalendarZoom((zoom) => Math.min(1.6, zoom + .1)); return }
      if (mod && event.key === '-') { event.preventDefault(); setCalendarZoom((zoom) => Math.max(.65, zoom - .1)); return }
      if (mod && key === 'd' && current) { event.preventDefault(); setEditingTask(current); return }

      if (key === 'n') { event.preventDefault(); setCreatingTask({}); return }
      if (key === '1') { setView('inbox'); return }
      if (key === '2') { setView('today'); return }
      if (key === '3') { setView('upcoming'); return }
      if (key === '4') { setView('completed'); return }
      if (key === '5') { setView('calendar'); return }
      if (key === 'r') { setView('incomplete'); return }
      if (key === 'o') { if (groups[0]) setView(`group:${groups[0].id}`); return }
      if (key === 'g') { setToast('Groups replace projects and tags locally'); return }
      if (event.key === '?') { setShortcutHelp(true); return }
      if (event.key === '/') { setCommandPalette(true); return }
      if ((key === 'j' || key === 'k') && keyboardTasks.length) {
        event.preventDefault()
        const index = Math.max(0, keyboardTasks.findIndex((task) => task.id === current?.id))
        const next = key === 'j' ? Math.min(keyboardTasks.length - 1, index + 1) : Math.max(0, index - 1)
        setActiveTaskId(keyboardTasks[next].id)
        return
      }
      if (event.shiftKey && event.key === 'ArrowRight' && current) {
        event.preventDefault()
        zoning.current = { task: current }
        updateTask({ ...current, date: todayKey(), startMinutes: 540 })
        setView('calendar')
        setActiveTaskId(current.id)
        setToast('Smart Zoning · arrows move · Enter confirms')
        return
      }
      if ((key === 's' || key === 'p') && current) {
        event.preventDefault()
        if (key === 's') {
          updateTask({ ...current, date: current.date || todayKey(), startMinutes: current.startMinutes || 540 })
          setView('calendar')
          setToast('Task scheduled')
        } else setEditingTask({ ...current, date: current.date || todayKey() })
        return
      }
      if (key === 'e' && current) { event.preventDefault(); setEditingTask(current); return }
      if (event.key === 'Backspace' && current) { event.preventDefault(); removeTask(current.id); return }
      if (mod && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && current) {
        event.preventDefault()
        setTasks((items) => {
          const index = items.findIndex((task) => task.id === current.id)
          const targetIndex = Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
          const next = [...items]
          ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
          return next
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTaskId, autoExtend, commandPalette, creatingTask, deletingAllCompleted, deletingTask, editingGroup, editingTask, focusMode, focusTask, groups, hoveredTask, inboxTasks, now, removeTask, shortcutHelp, tasks, view, visibleTasks])

  const runCommand = (id: string) => {
    setCommandPalette(false)
    if (id === 'new') setCreatingTask({})
    if (id === 'capture') setCreatingTask({})
    if (id === 'focus') setFocusMode(true)
    if (id === 'calendar') setView('calendar')
    if (id === 'inbox') setView('inbox')
    if (id === 'today') setView('today')
    if (id === 'upcoming') setView('upcoming')
    if (id === 'completed') setView('completed')
    if (id === 'shortcuts') setShortcutHelp(true)
    if (id === 'schedule' && activeTask) {
      updateTask({ ...activeTask, date: activeTask.date || todayKey(), startMinutes: activeTask.startMinutes || 540 })
      setView('calendar')
    }
    if (id === 'edit' && activeTask) setEditingTask(activeTask)
    if (id === 'complete' && activeTask) completeTask(activeTask.id)
  }

  const trackHoveredTask = (target: EventTarget | null) => {
    const taskElement = (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-task-id]')
    setHoveredTaskId(taskElement?.dataset.taskId || null)
  }

  return <div className="app-shell" onMouseOver={(event) => {
    trackHoveredTask(event.target)
  }} onMouseMove={(event) => {
    trackHoveredTask(event.target)
  }} onMouseLeave={() => setHoveredTaskId(null)}>
    <header className="titlebar">
      <span className="app-brand" aria-label="Kinven">Kinven</span>
      <nav>
        <button className={view !== 'calendar' ? 'active' : ''} onClick={() => setView('today')}>Tasks</button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendar</button>
      </nav>
      <button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
    </header>

    <div className="workspace">
      <aside className="sidebar">
        <div className="search-box">
          <Search size={15} />
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
          {search && <button className="search-clear" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        <SidebarButton icon={<Inbox />} label="Inbox" count={inboxTasks.length} active={activeFilter === 'inbox'} onClick={() => selectFilter('inbox')} />
        <SidebarButton icon={<CalendarDays />} label="Today" count={tasks.filter((t) => matchesTaskView(t, 'today')).length} active={activeFilter === 'today'} onClick={() => selectFilter('today')} />
        <SidebarButton icon={<Clock3 />} label="Upcoming" count={tasks.filter((t) => !!t.date && t.date > todayKey() && !t.completed).length} active={activeFilter === 'upcoming'} onClick={() => selectFilter('upcoming')} />
        <SidebarButton icon={<CheckCircle2 />} label="Completed" count={completedTasks.length} active={activeFilter === 'completed'} onClick={() => selectFilter('completed')} />
        <div className="section-title"><span>Groups</span><button aria-label="Add group" onClick={() => setEditingGroup({ id: '', title: '', color: COLORS[0] })}><Plus size={15} /></button></div>
        {groups.map((group) => <div className={`group-row ${activeFilter === `group:${group.id}` ? 'active' : ''}`} key={group.id}>
          <button className="group-link" aria-label={group.title} onClick={() => selectFilter(`group:${group.id}`)}>
            <span className="color-dot" style={{ background: group.color }} /><span>{group.title}</span>
            <b aria-hidden="true">{tasks.filter((t) => t.groupId === group.id && !t.completed).length}</b>
          </button>
          <button className="group-edit" aria-label="Edit group" title={`Edit ${group.title}`} onClick={() => setEditingGroup(group)}><MoreHorizontal size={15} /></button>
        </div>)}
        <button className="sidebar-new" onClick={() => setCreatingTask({})}><Plus size={14} /> New task</button>
        <div className="local-badge"><Archive size={14} /> Saved locally</div>
      </aside>

      {view === 'calendar' && !searchActive ? <main className="calendar-view">
        <section className="planning-pane" data-inbox-drop onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
          const taskId = event.dataTransfer.getData('taskId')
          if (!taskId) return
          setTasks((items) => items.map((task) => task.id === taskId ? { ...task, date: null } : task))
          setToast('Moved to Inbox')
        }}>
          <div className="pane-heading">
            <div><span className="eyebrow">Planning</span><h2>{paneLabel}</h2></div>
            <div className="pane-actions">
              <button className="icon-button" aria-label="Open full list" title={`Open ${paneLabel} as a full list`} onClick={() => setView(paneFilter)}><Maximize2 /></button>
              <button className="icon-button" onClick={() => setCreatingTask({})}><Plus /></button>
            </div>
          </div>
          <div className="quick-create"><input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createQuickTask()} placeholder="New task" /></div>
          <p className="drag-hint">{paneFilter === 'inbox'
            ? 'Unscheduled tasks only. Drag onto the calendar to schedule.'
            : `Showing ${paneLabel}. Drag any task onto the calendar to reschedule.`}</p>
          <div className="backlog">
            {paneTasks.map((task) => <TaskRow task={task} group={task.groupId ? groupMap.get(task.groupId) : undefined} active={activeTaskId === task.id} key={task.id} onEdit={() => { setActiveTaskId(task.id); setEditingTask(task) }} onComplete={() => completeTask(task.id, !task.completed)} draggable />)}
            {!paneTasks.length && (paneFilter === 'inbox'
              ? <EmptyState title="Inbox zero" copy="Scheduled tasks appear on the calendar. Drop one here to unschedule." />
              : <EmptyState title={`${paneLabel} is empty`} copy="Nothing to plan here right now." />)}
          </div>
          <div className="inbox-drop-hint"><Inbox /> Drop calendar tasks here to unschedule</div>
        </section>
        <section className="calendar-pane">
          <CalendarToolbar anchor={anchor} range={range} setRange={setRange} move={(n) => setAnchor((d) => range === 'month' ? addMonths(d, n) : addDays(d, n * (range as number)))} reset={() => setAnchor(new Date())} />
          {range === 'month'
            ? <MonthCalendar days={calendarDays} anchor={anchor} tasks={tasks} groupMap={groupMap} onTask={(task) => { setActiveTaskId(task.id); setEditingTask(task) }} onDay={openScheduledTask} />
            : <TimeCalendar days={calendarDays} tasks={tasks} groupMap={groupMap} onTask={(task) => { setActiveTaskId(task.id); setEditingTask(task) }} onEmpty={openScheduledTask} onDrop={scheduleDroppedTask} updateTask={updateTask} completeTask={completeTask} zoom={calendarZoom} activeTaskId={activeTaskId} />}
        </section>
      </main> : <ListView
        view={view}
        groups={groups}
        groupMap={groupMap}
        visibleTasks={visibleTasks}
        searchActive={searchActive}
        searchQuery={search}
        setSearch={setSearch}
        quickTitle={quickTitle}
        setQuickTitle={setQuickTitle}
        createQuickTask={createQuickTask}
        selectionMode={selectionMode}
        setSelectionMode={setSelectionMode}
        selected={selected}
        setSelected={setSelected}
        toggleSelected={toggleSelected}
        batch={batch}
        onDeleteAllCompleted={() => setDeletingAllCompleted(true)}
        activeTaskId={activeTaskId}
        setActiveTaskId={setActiveTaskId}
        setEditingTask={setEditingTask}
        setCreatingTask={setCreatingTask}
        completeTask={completeTask}
      />}
    </div>

    {(editingTask || creatingTask) && <TaskModal key={editingTask?.id || 'new-task'} task={editingTask} draft={creatingTask} groups={groups} initialSection={editingTask ? editingSection : 'general'} onCreateGroup={(group) => setGroups((items) => [...items, group])} onClose={() => { setEditingTask(null); setCreatingTask(null); setEditingSection('general') }} onDelete={(id) => {
      const task = tasks.find((item) => item.id === id)
      if (task) setDeletingTask(task)
    }} onSave={(task) => {
      if (editingTask && tasks.some((item) => item.id !== editingTask.id && sameSeries(item, editingTask))) {
        setPendingSeriesAction({ kind: 'edit', original: editingTask, next: task })
        return
      }
      if (editingTask && !editingTask.seriesId && task.repeat !== 'none') {
        setTasks((items) => [...items.filter((item) => item.id !== editingTask.id), ...expandRecurrences(task)])
      } else if (editingTask) updateTask(task)
      else setTasks((items) => [...items, ...expandRecurrences(task)])
      setEditingTask(null); setCreatingTask(null); setEditingSection('general')
    }} />}
    {editingGroup && <GroupModal group={editingGroup} onClose={() => setEditingGroup(null)} onDelete={deleteGroup} onSave={(group) => {
      setGroups((items) => editingGroup.id ? items.map((item) => item.id === group.id ? group : item) : [...items, { ...group, id: uid() }])
      setEditingGroup(null)
    }} />}
    {focusMode && <FocusScreen task={focusTask} autoExtend={autoExtend} addingSubtask={focusSubtask} onExit={() => setFocusMode(false)} onEdit={() => focusTask && setEditingTask(focusTask)} onComplete={() => focusTask && completeTask(focusTask.id)} onSubtask={(title) => {
      if (!focusTask) return
      updateTask({ ...focusTask, subtasks: [...(focusTask.subtasks || []), { id: uid(), title, completed: false }] })
      setFocusSubtask(false)
    }} onToggleSubtask={(id) => {
      if (!focusTask) return
      updateTask({ ...focusTask, subtasks: (focusTask.subtasks || []).map((subtask) => subtask.id === id ? { ...subtask, completed: !subtask.completed } : subtask) })
    }} />}
    {commandPalette && <CommandPalette onClose={() => setCommandPalette(false)} onRun={runCommand} />}
    {shortcutHelp && <ShortcutReference onClose={() => setShortcutHelp(false)} />}
    {toast && <div className="shortcut-toast">{toast}</div>}
    {pendingSeriesAction && <RecurrenceScopeModal kind={pendingSeriesAction.kind} onClose={() => setPendingSeriesAction(null)} onChoose={applySeriesAction} />}
    {deletingTask && <DeleteTaskModal task={deletingTask} onClose={() => setDeletingTask(null)} onConfirm={() => {
      const taskId = deletingTask.id
      setDeletingTask(null)
      removeTask(taskId)
    }} />}
    {deletingAllCompleted && <DeleteAllCompletedModal count={completedTasks.length} onClose={() => setDeletingAllCompleted(false)} onConfirm={deleteAllCompleted} />}
  </div>
}

function ListView({
  view, groups, groupMap, visibleTasks, searchActive, searchQuery, setSearch, quickTitle, setQuickTitle, createQuickTask,
  selectionMode, setSelectionMode, selected, setSelected, toggleSelected, batch, onDeleteAllCompleted,
  activeTaskId, setActiveTaskId, setEditingTask, setCreatingTask, completeTask,
}: {
  view: View
  groups: Group[]
  groupMap: Map<string, Group>
  visibleTasks: Task[]
  searchActive: boolean
  searchQuery: string
  setSearch: (value: string) => void
  quickTitle: string
  setQuickTitle: (value: string) => void
  createQuickTask: () => void
  selectionMode: boolean
  setSelectionMode: (enabled: boolean) => void
  selected: Set<string>
  setSelected: Dispatch<SetStateAction<Set<string>>>
  toggleSelected: (id: string) => void
  batch: (action: 'complete' | 'incomplete' | 'delete' | 'inbox' | 'group', groupId?: string | null) => void
  onDeleteAllCompleted: () => void
  activeTaskId: string | null
  setActiveTaskId: (id: string) => void
  setEditingTask: (task: Task) => void
  setCreatingTask: (draft: Partial<Task> | null) => void
  completeTask: (id: string, complete?: boolean) => void
}) {
  const scheduledTasks = visibleTasks.filter((task) => !!task.date)
  const unscheduledTasks = visibleTasks.filter((task) => !task.date)
  const showSections = scheduledTasks.length > 0 && unscheduledTasks.length > 0
  const scheduledCount = visibleTasks.filter((task) => !!task.date).length
  const unscheduledCount = visibleTasks.length - scheduledCount
  const taskSummary = scheduledCount > 0 && unscheduledCount > 0
    ? `${visibleTasks.length} tasks · ${scheduledCount} scheduled · ${unscheduledCount} unscheduled`
    : scheduledCount > 0
      ? `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'} · all scheduled`
      : unscheduledCount > 0
        ? `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'} · all unscheduled`
        : `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'}`

  const renderTask = (task: Task) => <TaskRow
    task={task}
    group={task.groupId ? groupMap.get(task.groupId) : undefined}
    active={activeTaskId === task.id}
    key={task.id}
    showScheduleBadge
    selectionMode={selectionMode}
    selected={selected.has(task.id)}
    onToggleSelect={() => toggleSelected(task.id)}
    onEdit={() => { setActiveTaskId(task.id); setEditingTask(task) }}
    onComplete={() => completeTask(task.id, !task.completed)}
  />

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelected(new Set())
  }

  const listTitle = searchActive
    ? 'Search'
    : view.startsWith('group:')
      ? groupMap.get(view.slice(6))?.title
      : view[0].toUpperCase() + view.slice(1)
  const listSummary = searchActive
    ? `${visibleTasks.length} ${visibleTasks.length === 1 ? 'result' : 'results'} for “${searchQuery.trim()}”`
    : taskSummary

  return <main className="list-view">
    <div className="list-header">
      <div>
        <span className="eyebrow">Tasks</span>
        <h1>{listTitle}</h1>
        <p>{listSummary}</p>
      </div>
      <div className="list-header-actions">
        {view === 'completed' && !searchActive && visibleTasks.length > 0 && !selectionMode && (
          <button className="select-toggle danger-outline" onClick={onDeleteAllCompleted}>Delete all</button>
        )}
        <button
          className={`select-toggle ${selectionMode ? 'active' : ''}`}
          aria-pressed={selectionMode}
          onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
        >
          {selectionMode ? 'Done' : 'Select'}
        </button>
        <button className="primary" onClick={() => setCreatingTask({ groupId: view.startsWith('group:') ? view.slice(6) : null })}><Plus size={17} /> Add task</button>
      </div>
    </div>
    {searchActive && <div className="search-results-banner"><span>Showing matches across all tasks.</span><button onClick={() => setSearch('')}>Clear search</button></div>}
    {view === 'inbox' && !searchActive && <p className="view-hint">Inbox holds unscheduled tasks only. Once a task gets a date it moves to Today, Upcoming, and the calendar.</p>}
    <div className="quick-create large"><input autoFocus={!searchActive} value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createQuickTask()} placeholder="Type tasks separated by semicolons, then press Enter…" /><span>Quick add</span></div>
    {selectionMode && <div className="batch-bar">
      <b>{selected.size} selected</b>
      {visibleTasks.length > 0 && <button onClick={() => setSelected(new Set(visibleTasks.map((task) => task.id)))}>Select all</button>}
      {selected.size > 0 && <>
      <button onClick={() => batch('complete')}><Check /> Complete</button>
      {view === 'completed' && <button onClick={() => batch('incomplete')}><Circle /> Mark incomplete</button>}
      <button onClick={() => batch('inbox')}><Inbox /> Move to inbox</button>
      <label className="batch-group">
        <span>Group</span>
        <select aria-label="Group" defaultValue="" onChange={(e) => {
          if (!e.target.value) return
          batch('group', e.target.value === '__none__' ? null : e.target.value)
          e.target.value = ''
        }}>
          <option value="">Assign…</option>
          <option value="__none__">No group</option>
          {groups.map((group) => <option value={group.id} key={group.id}>{group.title}</option>)}
        </select>
      </label>
      <button className="danger-text" onClick={() => batch('delete')}><Trash2 /> Delete</button>
      <button onClick={() => setSelected(new Set())}><X /></button>
      </>}
    </div>}
    {selectionMode && <p className="selection-hint">Tap tasks to select them, then use the actions above.</p>}
    <div className="task-list">
      {showSections ? <>
        <section className="task-section">
          <h3 className="task-section-title">Scheduled</h3>
          <div className="task-section-list">{scheduledTasks.map(renderTask)}</div>
        </section>
        <section className="task-section">
          <h3 className="task-section-title">Unscheduled</h3>
          <div className="task-section-list">{unscheduledTasks.map(renderTask)}</div>
        </section>
      </> : visibleTasks.map(renderTask)}
      {!visibleTasks.length && (view === 'inbox' && !searchActive
        ? <EmptyState title="Inbox zero" copy="Nothing unscheduled. Scheduled tasks live in Today, Upcoming, and the calendar." />
        : <EmptyState title="All clear" copy="Nothing needs your attention here." />)}
    </div>
  </main>
}

function SidebarButton({ icon, label, count, active, onClick }: { icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void }) {
  return <button className={`sidebar-button ${active ? 'active' : ''}`} aria-label={label} onClick={onClick}><span>{icon}{label}</span>{count > 0 && <b aria-hidden="true">{count}</b>}</button>
}
function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><span><Check /></span><h3>{title}</h3><p>{copy}</p></div>
}

function CommandPalette({ onClose, onRun }: { onClose: () => void; onRun: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const commands = [
    ['new', 'Create new task', 'N'], ['capture', 'Universal Capture', 'Double ⌘'],
    ['focus', 'Enter Focus Mode', 'Tab'], ['schedule', 'Schedule selected task', 'S'],
    ['edit', 'Edit selected task', 'E'], ['complete', 'Complete selected task', 'E'],
    ['calendar', 'Open calendar', '5'], ['inbox', 'Go to Inbox', '1'],
    ['today', 'Go to Today', '2'], ['upcoming', 'Go to Upcoming', '3'],
    ['completed', 'Go to Completed', '4'], ['shortcuts', 'Show all shortcuts', '?'],
  ]
  const filtered = commands.filter((command) => command[1].toLowerCase().includes(query.toLowerCase()))
  return <div className="modal-backdrop palette-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div className="command-palette">
      <div className="palette-search"><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && filtered[0] && onRun(filtered[0][0])} placeholder="Search actions…" /><kbd>Esc</kbd></div>
      <div className="palette-results">
        {filtered.map(([id, label, shortcut], index) => <button className={index === 0 ? 'active' : ''} onClick={() => onRun(id)} key={id}><span>{label}</span><kbd>{shortcut}</kbd></button>)}
      </div>
      <footer><span>↑↓ Navigate</span><span>↵ Select</span><span>? Shortcuts</span></footer>
    </div>
  </div>
}

function ShortcutReference({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div className="shortcut-reference">
      <div className="modal-title"><div><span className="eyebrow">Keyboard first</span><h2>Shortcut reference</h2></div><button className="icon-button" onClick={onClose}><X /></button></div>
      <div className="shortcut-columns">{SHORTCUT_GROUPS.map((group) => <section key={group.title}><h3>{group.title}</h3>{group.items.map(([shortcut, action]) => <div key={`${shortcut}-${action}`}><span>{action}</span><kbd>{shortcut}</kbd></div>)}</section>)}</div>
      <p className="shortcut-note">Double Command works while this browser app is active. System-wide capture requires a native macOS build.</p>
    </div>
  </div>
}

function RecurrenceScopeModal({ kind, onClose, onChoose }: { kind: 'edit' | 'delete'; onClose: () => void; onChoose: (scope: RecurrenceScope) => void }) {
  const verb = kind === 'edit' ? 'Apply changes to' : 'Delete'
  return <div className="modal-backdrop recurrence-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div className="recurrence-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><span className="eyebrow">Recurring task</span><h2>{kind === 'edit' ? 'Which tasks should change?' : 'Which tasks should be deleted?'}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div>
      <p>This task belongs to a repeating series. Choose the range before continuing.</p>
      <div className="scope-options">
        <button type="button" onClick={() => onChoose('only')}><strong>This task only</strong><span>{verb} this occurrence without affecting the rest.</span></button>
        <button type="button" onClick={() => onChoose('past')}><strong>This and all previous tasks</strong><span>{verb} this occurrence and every earlier occurrence.</span></button>
        <button type="button" onClick={() => onChoose('future')}><strong>This and all future tasks</strong><span>{verb} this occurrence and every later occurrence.</span></button>
        <button type="button" className={kind === 'delete' ? 'danger-option' : ''} onClick={() => onChoose('all')}><strong>All previous and future tasks</strong><span>{verb} the entire repeating series.</span></button>
      </div>
    </div>
  </div>
}

function DeleteTaskModal({ task, onClose, onConfirm }: { task: Task; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop delete-confirm-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div className="delete-confirm-modal" role="alertdialog" aria-labelledby="delete-task-title">
      <div className="delete-confirm-icon"><Trash2 /></div>
      <h2 id="delete-task-title">Delete “{task.title}”?</h2>
      <p>This cannot be undone from the task menu.</p>
      <div><button onClick={onClose}>Cancel</button><button className="confirm-delete" autoFocus onClick={onConfirm}>Delete task</button></div>
    </div>
  </div>
}

function DeleteAllCompletedModal({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop delete-confirm-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div className="delete-confirm-modal" role="alertdialog" aria-labelledby="delete-completed-title">
      <div className="delete-confirm-icon"><Trash2 /></div>
      <h2 id="delete-completed-title">Delete all completed tasks?</h2>
      <p>This will permanently remove {count} completed {count === 1 ? 'task' : 'tasks'}.</p>
      <div><button onClick={onClose}>Cancel</button><button className="confirm-delete" autoFocus onClick={onConfirm}>Delete all</button></div>
    </div>
  </div>
}

function FocusScreen({ task, autoExtend, addingSubtask, onExit, onEdit, onComplete, onSubtask, onToggleSubtask }: {
  task?: Task; autoExtend: boolean; addingSubtask: boolean; onExit: () => void
  onEdit: () => void; onComplete: () => void; onSubtask: (title: string) => void
  onToggleSubtask: (id: string) => void
}) {
  const [subtaskTitle, setSubtaskTitle] = useState('')
  return <div className="focus-screen">
    <header><div><Sparkles /><span>Focus Mode</span></div><button onClick={onExit}>Calendar <kbd>Tab</kbd></button></header>
    {task ? <main>
      <span className="focus-eyebrow">{task.date ? `${format(parseISO(task.date), 'EEEE, MMMM d')} · ${minutesToTime(task.startMinutes)}` : 'From your inbox'}</span>
      <button className="focus-check" onClick={onComplete} aria-label="Complete task"><Circle /></button>
      <h1 onClick={onEdit}>{task.title}</h1>
      {task.notes && <p>{task.notes}</p>}
      <div className="focus-meta"><span><Clock3 /> {task.duration} minutes</span>{autoExtend && <span className="auto-extend"><Repeat2 /> Auto-Extend</span>}</div>
      {!!task.subtasks?.length && <div className="focus-subtasks">{task.subtasks.map((subtask) => <button onClick={() => onToggleSubtask(subtask.id)} className={subtask.completed ? 'done' : ''} key={subtask.id}>{subtask.completed ? <Check /> : <Circle />}<span>{subtask.title}</span></button>)}</div>}
      {addingSubtask && <input className="focus-subtask-input" autoFocus value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter' && subtaskTitle.trim()) { onSubtask(subtaskTitle.trim()); setSubtaskTitle('') }
      }} placeholder="Add a subtask and press Enter…" />}
    </main> : <main><span className="focus-eyebrow">Nothing scheduled</span><h1>You're all clear.</h1></main>}
    <footer><span><kbd>E</kbd> Complete</span><span><kbd>⌘S</kbd> Subtask</span><span><kbd>+</kbd> Extend</span><span><kbd>−</kbd> Shorten</span><span><kbd>B</kbd> Break</span><span><kbd>/</kbd> Actions</span></footer>
  </div>
}

function TaskRow({
  task, group, onEdit, onComplete, draggable = false, active = false,
  showScheduleBadge = false, selectionMode = false, selected = false, onToggleSelect,
}: {
  task: Task; group?: Group; onEdit: () => void; onComplete: () => void; draggable?: boolean; active?: boolean
  showScheduleBadge?: boolean; selectionMode?: boolean; selected?: boolean; onToggleSelect?: () => void
}) {
  return <div
    data-task-id={task.id}
    className={`task-row ${task.completed ? 'done' : ''} ${active ? 'keyboard-active' : ''} ${selectionMode ? 'selectable' : ''} ${selected ? 'selected' : ''}`}
    draggable={draggable && !selectionMode}
    onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
    onClick={() => selectionMode ? onToggleSelect?.() : onEdit()}
  >
    <button className="check-button" onClick={(e) => { e.stopPropagation(); onComplete() }} aria-label={task.completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}>{task.completed ? <Check /> : <Circle />}</button>
    <div className="task-copy">
      <strong>{task.title}</strong>
      <span className="task-meta">
        {showScheduleBadge && <em className={`schedule-badge ${task.date ? 'scheduled' : 'unscheduled'}`}>
          {task.date ? `${format(parseISO(task.date), 'EEE MMM d')} · ${minutesToTime(task.startMinutes)}` : 'Unscheduled'}
        </em>}
        {group && <span className="task-group"><i style={{ background: group.color }} />{group.title}</span>}
        {!showScheduleBadge && <>
          {group && <><i style={{ background: group.color }} />{group.title}</>}
          {task.date && ` · ${format(parseISO(task.date), 'MMM d')}`}
          {task.date && ` · ${minutesToTime(task.startMinutes)}`}
        </>}
      </span>
    </div>
    <span className="duration">{(task.repeat !== 'none' || task.seriesRepeat || task.seriesId) && <Repeat2 size={12} />}{task.duration}m</span>
  </div>
}

function CalendarToolbar({ anchor, range, setRange, move, reset }: { anchor: Date; range: CalendarRange; setRange: (range: CalendarRange) => void; move: (n: number) => void; reset: () => void }) {
  return <div className="calendar-toolbar">
    <div><span className="eyebrow">Calendar</span><h2>{range === 'month' ? format(anchor, 'MMMM yyyy') : `${format(startOfWeek(anchor, { weekStartsOn: 1 }), 'MMM d')} – ${format(addDays(startOfWeek(anchor, { weekStartsOn: 1 }), 6), 'MMM d, yyyy')}`}</h2></div>
    <div className="toolbar-actions">
      <select value={range} onChange={(e) => setRange(e.target.value === 'month' ? 'month' : Number(e.target.value) as CalendarRange)}><option value={1}>1 day</option><option value={3}>3 days</option><option value={5}>5 days</option><option value={7}>7 days</option><option value="month">Month</option></select>
      <button onClick={reset}>Today</button><button className="icon-button" onClick={() => move(-1)}><ChevronLeft /></button><button className="icon-button" onClick={() => move(1)}><ChevronRight /></button>
    </div>
  </div>
}

// Re-reading the clock also picks up OS timezone changes, since Date reflects the current zone.
function useCurrentTime(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const sync = () => setNow(new Date())
    const timer = window.setInterval(sync, intervalMs)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [intervalMs])
  return now
}

function TimeCalendar({ days, tasks, groupMap, onTask, onEmpty, onDrop, updateTask, completeTask, zoom, activeTaskId }: {
  days: Date[]; tasks: Task[]; groupMap: Map<string, Group>; onTask: (task: Task) => void
  onEmpty: (day: Date, startMinutes: number) => void; onDrop: (id: string, day: Date, y: number, rect: DOMRect) => void
  updateTask: (task: Task) => void; completeTask: (id: string, complete?: boolean) => void; zoom: number; activeTaskId: string | null
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const now = useCurrentTime()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowOffset = minutesToOffset(nowMinutes)
  const today = dateToKey(now)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = scrollRef.current
    const grid = container?.querySelector('.time-grid') as HTMLElement | null
    if (!container || !grid) return
    const minutes = new Date().getHours() * 60 + new Date().getMinutes()
    container.scrollTop = Math.max(0, (minutes / DAY_MINUTES) * grid.offsetHeight - container.clientHeight / 3)
  }, [])
  return <div className="time-calendar" ref={scrollRef}>
    <div className="day-headers" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(90px, 1fr))` }}><div />{days.map((day) => <div className={`${isToday(day) ? 'today' : ''} ${dateToKey(day) < today ? 'past' : ''}`} key={day.toString()}><span>{format(day, 'EEE')}</span><b>{format(day, 'd')}</b></div>)}</div>
    <div className="time-grid" style={{ minHeight: `${GRID_HEIGHT * zoom}px` }}>
      <div className="hours">
        {hours.map((hour) => <span style={{ top: `${minutesToOffset(hour * 60)}%` }} key={hour}>{format(new Date(2020, 1, 1, hour), 'h a')}</span>)}
        <b className="now-label" style={{ top: `${nowOffset}%` }}>{format(now, 'h:mm')}</b>
      </div>
      {days.map((day) => {
        const dayKey = dateToKey(day)
        return <div className={`day-column ${dayKey === today ? 'today' : ''} ${dayKey < today ? 'past' : ''}`} data-date={dayKey} key={day.toString()} onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          onEmpty(day, offsetToMinutes((e.clientY - rect.top) / rect.height))
        }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e.dataTransfer.getData('taskId'), day, e.clientY, e.currentTarget.getBoundingClientRect())}>
          {hours.map((hour) => <i className="hour-line" style={{ top: `${minutesToOffset(hour * 60)}%` }} key={hour} />)}
          {dayKey === today && <i className="now-line" data-testid="now-line" style={{ top: `${nowOffset}%` }} />}
          {tasks.filter((t) => t.date === dayKey).map((task) => {
            const group = task.groupId ? groupMap.get(task.groupId) : undefined
            return <CalendarTask task={task} color={group?.color || '#6f7785'} active={activeTaskId === task.id} onTask={onTask} updateTask={updateTask} completeTask={completeTask} key={task.id} />
          })}
        </div>
      })}
    </div>
  </div>
}

function CalendarTask({ task, color, active, onTask, updateTask, completeTask }: {
  task: Task; color: string; active: boolean; onTask: (task: Task) => void
  updateTask: (task: Task) => void; completeTask: (id: string, complete?: boolean) => void
}) {
  const drag = useRef<{ x: number; y: number; moved: boolean; rect: DOMRect } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPreview, setDragPreview] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const top = minutesToOffset(task.startMinutes)
  const minimumMinutes = task.duration <= 15 ? 20 : task.duration <= 30 ? 30 : 36
  const height = minutesToOffset(Math.max(task.duration, minimumMinutes))

  return <div
    className={`calendar-task ${task.completed ? 'completed-task' : ''} ${task.duration <= 30 ? 'compact-task' : ''} ${task.duration <= 15 ? 'tiny-task' : ''} ${isDragging ? 'dragging' : ''} ${active ? 'keyboard-active' : ''}`}
    data-task-id={task.id}
    title={`${task.title} · ${minutesToTime(task.startMinutes)} · ${task.duration} minutes`}
    onClick={(e) => {
      e.stopPropagation()
      if (!drag.current?.moved) onTask(task)
    }}
    onPointerDown={(e) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button, .resize-handle')) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { x: e.clientX, y: e.clientY, moved: false, rect: e.currentTarget.getBoundingClientRect() }
    }}
    onPointerMove={(e) => {
      if (!drag.current) return
      if (Math.abs(e.clientY - drag.current.y) > 3 || Math.abs(e.clientX - drag.current.x) > 3) {
        drag.current.moved = true
        setIsDragging(true)
      }
      if (drag.current.moved) {
        setDragPreview({
          left: drag.current.rect.left + e.clientX - drag.current.x,
          top: drag.current.rect.top + e.clientY - drag.current.y,
          width: drag.current.rect.width,
          height: drag.current.rect.height,
        })
      }
    }}
    onPointerUp={(e) => {
      e.currentTarget.style.visibility = 'hidden'
      const dropTarget = document.elementFromPoint(e.clientX, e.clientY)
      e.currentTarget.style.visibility = ''
      if (drag.current?.moved) {
        if (dropTarget?.closest('[data-inbox-drop]')) {
          updateTask({ ...task, date: null })
        } else {
          const targetColumn = dropTarget?.closest('.day-column') as HTMLElement | null
          if (targetColumn) {
            const rect = targetColumn.getBoundingClientRect()
            const rawMinutes = offsetToMinutes((e.clientY - rect.top) / rect.height)
            const startMinutes = Math.max(0, Math.min(DAY_MINUTES - task.duration, rawMinutes))
            updateTask({ ...task, date: targetColumn.dataset.date || task.date, startMinutes })
          }
        }
      }
      e.currentTarget.releasePointerCapture(e.pointerId)
      setDragPreview(null)
      window.setTimeout(() => { drag.current = null; setIsDragging(false) }, 0)
    }}
    onPointerCancel={() => {
      setDragPreview(null)
      drag.current = null
      setIsDragging(false)
    }}
    style={dragPreview
      ? { position: 'fixed', left: dragPreview.left, top: dragPreview.top, width: dragPreview.width, height: dragPreview.height, '--task-color': color } as React.CSSProperties
      : { top: `${top}%`, height: `${height}%`, '--task-color': color } as React.CSSProperties}
  >
    <button aria-label={`Mark ${task.title} ${task.completed ? 'incomplete' : 'complete'}`} onClick={(e) => { e.stopPropagation(); completeTask(task.id, !task.completed) }}>{task.completed && <Check size={10} />}</button>
    <strong>{task.title}</strong><small>{minutesToTime(task.startMinutes)} · {task.duration}m</small>
    <ResizeHandle task={task} updateTask={updateTask} />
  </div>
}

function ResizeHandle({ task, updateTask }: { task: Task; updateTask: (task: Task) => void }) {
  const start = useRef<{ y: number; duration: number; pixelsPerMinute: number } | null>(null)
  return <span className="resize-handle" onPointerDown={(e) => {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const column = e.currentTarget.closest('.day-column') as HTMLElement | null
    start.current = { y: e.clientY, duration: task.duration, pixelsPerMinute: (column?.getBoundingClientRect().height || GRID_HEIGHT) / DAY_MINUTES }
  }} onPointerMove={(e) => {
    if (!start.current) return
    const delta = Math.round(((e.clientY - start.current.y) / start.current.pixelsPerMinute) / 15) * 15
    updateTask({ ...task, duration: Math.max(15, Math.min(360, start.current.duration + delta)) })
  }} onPointerUp={() => { start.current = null }} />
}

function MonthCalendar({ days, anchor, tasks, groupMap, onTask, onDay }: { days: Date[]; anchor: Date; tasks: Task[]; groupMap: Map<string, Group>; onTask: (task: Task) => void; onDay: (date: Date) => void }) {
  return <div className="month-calendar">
    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <b className="month-weekday" key={day}>{day}</b>)}
    {days.map((day) => <div className={`month-day ${day.getMonth() !== anchor.getMonth() ? 'muted' : ''} ${isToday(day) ? 'today' : ''}`} onDoubleClick={() => onDay(day)} key={day.toString()}>
      <span>{format(day, 'd')}</span>
      {tasks.filter((task) => task.date === dateToKey(day)).slice(0, 4).map((task) => <button data-task-id={task.id} className={task.completed ? 'completed-task' : ''} onClick={() => onTask(task)} key={task.id} style={{ '--task-color': task.groupId ? groupMap.get(task.groupId)?.color : '#6f7785' } as React.CSSProperties}>{task.completed && <Check size={9} />}{task.title}</button>)}
    </div>)}
  </div>
}

function TaskModal({ task, draft, groups, initialSection, onCreateGroup, onClose, onDelete, onSave }: { task: Task | null; draft: Partial<Task> | null; groups: Group[]; initialSection: TaskEditSection; onCreateGroup: (group: Group) => void; onClose: () => void; onDelete: (id: string) => void; onSave: (task: Task) => void }) {
  const [form, setForm] = useState<Task>(() => task || {
    id: uid(), title: '', notes: '', groupId: draft?.groupId ?? null, date: draft?.date ?? null,
    startMinutes: draft?.startMinutes ?? 540, duration: draft?.duration ?? 30, completed: false, repeat: 'none', createdAt: Date.now(),
  })
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupTitle, setNewGroupTitle] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const dateRef = useRef<HTMLInputElement>(null)
  const groupRef = useRef<HTMLSelectElement>(null)
  const subtaskRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (initialSection === 'date') dateRef.current?.focus()
    if (initialSection === 'group') groupRef.current?.focus()
    if (initialSection === 'subtasks') subtaskRef.current?.focus()
  }, [initialSection])
  const save = () => form.title.trim() && onSave({ ...form, title: form.title.trim() })
  const createGroup = () => {
    if (!newGroupTitle.trim()) return
    const group = { id: uid(), title: newGroupTitle.trim(), color: COLORS[0] }
    onCreateGroup(group)
    setForm((current) => ({ ...current, groupId: group.id }))
    setNewGroupTitle('')
    setCreatingGroup(false)
  }
  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    setForm((current) => ({ ...current, subtasks: [...(current.subtasks || []), { id: uid(), title: newSubtaskTitle.trim(), completed: false }] }))
    setNewSubtaskTitle('')
    window.setTimeout(() => subtaskRef.current?.focus(), 0)
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
    <div className="modal">
      <div className="modal-title"><div><span className="eyebrow">{task ? 'Task details' : 'New task'}</span>{task && <h2>Edit task</h2>}</div><button className="icon-button" onClick={onClose}><X /></button></div>
      <label>Title<input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save()} placeholder="What needs doing?" /></label>
      <label>Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add context or a checklist…" /></label>
      <div className="form-grid">
        <label>Group<select ref={groupRef} aria-label="Group" value={creatingGroup ? '__create__' : form.groupId || ''} onChange={(e) => {
          if (e.target.value === '__create__') setCreatingGroup(true)
          else { setCreatingGroup(false); setForm({ ...form, groupId: e.target.value || null }) }
        }}><option value="">No group</option>{groups.map((g) => <option value={g.id} key={g.id}>{g.title}</option>)}{!task && <option value="__create__">+ Create new group…</option>}</select>
          {creatingGroup && <div className="inline-group-create"><input aria-label="New group name" autoFocus value={newGroupTitle} onChange={(e) => setNewGroupTitle(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); createGroup() }
          }} placeholder="Group name" /><button type="button" aria-label="Create group" onClick={createGroup}>Add</button></div>}
        </label>
        <label>Date<input ref={dateRef} type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value || null })} /></label>
        {form.date && <label>Start<input type="time" value={minutesToTime(form.startMinutes)} onChange={(e) => setForm({ ...form, startMinutes: timeToMinutes(e.target.value) })} /></label>}
        <label>Duration<select value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>{[15, 30, 45, 60, 90, 120, 180].map((n) => <option value={n} key={n}>{n < 60 ? `${n} min` : `${n / 60} hr`}</option>)}</select></label>
        <label>Repeat<select value={form.repeat} onChange={(e) => {
          const repeat = e.target.value as RepeatRule
          setForm({ ...form, repeat, date: repeat !== 'none' && !form.date ? todayKey() : form.date })
        }}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
      </div>
      <section className="subtasks-editor" aria-label="Subtasks">
        <div className="subtasks-heading"><div><strong>Subtasks</strong><span>{form.subtasks?.filter((subtask) => subtask.completed).length || 0}/{form.subtasks?.length || 0} done</span></div></div>
        <div className="subtask-items">
          {(form.subtasks || []).map((subtask) => <div className={`subtask-edit-row ${subtask.completed ? 'done' : ''}`} key={subtask.id}>
            <button type="button" aria-label={`Mark ${subtask.title || 'subtask'} ${subtask.completed ? 'incomplete' : 'complete'}`} onClick={() => setForm((current) => ({ ...current, subtasks: (current.subtasks || []).map((item) => item.id === subtask.id ? { ...item, completed: !item.completed } : item) }))}>{subtask.completed ? <Check /> : <Circle />}</button>
            <input aria-label="Subtask title" value={subtask.title} onChange={(e) => setForm((current) => ({ ...current, subtasks: (current.subtasks || []).map((item) => item.id === subtask.id ? { ...item, title: e.target.value } : item) }))} />
            <button type="button" aria-label={`Delete ${subtask.title || 'subtask'}`} onClick={() => setForm((current) => ({ ...current, subtasks: (current.subtasks || []).filter((item) => item.id !== subtask.id) }))}><X /></button>
          </div>)}
        </div>
        <div className="add-subtask-row"><input ref={subtaskRef} aria-label="Add subtask" value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addSubtask() }
        }} placeholder="Add a subtask…" /><button type="button" onClick={addSubtask}><Plus /> Add</button></div>
      </section>
      <div className="modal-actions">{task ? <button className="danger-text" onClick={() => onDelete(task.id)}><Trash2 /> Delete</button> : <span />}<div>{form.date && <button onClick={() => setForm({ ...form, date: null })}><Inbox /> Move to inbox</button>}<button className="primary" onClick={save}>{task ? 'Save changes' : 'Create task'}</button></div></div>
    </div>
  </div>
}

function GroupModal({ group, onClose, onDelete, onSave }: { group: Group; onClose: () => void; onDelete: (id: string) => void; onSave: (group: Group) => void }) {
  const [form, setForm] = useState(group)
  return <div className="modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && onClose()}><div className="modal compact">
    <div className="modal-title"><div><span className="eyebrow">{group.id ? 'Group settings' : 'New group'}</span><h2>{group.id ? 'Edit group' : 'Organise your work'}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div>
    <label>Group title<input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Client work" /></label>
    <label>Color<div className="color-picker">{COLORS.map((color) => <button className={form.color === color ? 'active' : ''} style={{ background: color }} onClick={() => setForm({ ...form, color })} key={color}>{form.color === color && <Check />}</button>)}</div></label>
    <div className="modal-actions">{group.id ? <button className="danger-text" onClick={() => onDelete(group.id)}><Trash2 /> Delete group</button> : <span />}<button className="primary" onClick={() => form.title.trim() && onSave({ ...form, title: form.title.trim() })}>Save group</button></div>
  </div></div>
}

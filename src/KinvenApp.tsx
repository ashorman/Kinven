import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Circle, Clock3, Inbox, Moon, MoreHorizontal, Plus, Repeat2, Search, Sparkles,
  Sun, Trash2, X,
} from 'lucide-react'
import {
  addDays, addMonths, addWeeks, addYears, eachDayOfInterval, endOfMonth,
  differenceInCalendarDays, format, isToday, parseISO, startOfMonth, startOfWeek,
} from 'date-fns'
import './Kinven.css'

type RepeatRule = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'
type CalendarRange = 1 | 3 | 5 | 7 | 'month'
type View = 'calendar' | 'inbox' | 'today' | 'upcoming' | 'completed' | 'incomplete' | `group:${string}`
type Task = {
  id: string; title: string; notes: string; groupId: string | null
  date: string | null; startMinutes: number; duration: number
  completed: boolean; repeat: RepeatRule; createdAt: number
  subtasks?: { id: string; title: string; completed: boolean }[]
  seriesId?: string
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
  if (!task.date || task.repeat === 'none') return null
  let next = parseISO(task.date)
  if (task.repeat === 'daily') next = addDays(next, 1)
  if (task.repeat === 'weekly') next = addWeeks(next, 1)
  if (task.repeat === 'monthly') next = addMonths(next, 1)
  if (task.repeat === 'yearly') next = addYears(next, 1)
  if (task.repeat === 'weekdays') {
    next = addDays(next, 1)
    while ([0, 6].includes(next.getDay())) next = addDays(next, 1)
  }
  return dateToKey(next)
}

function expandRecurrences(task: Task) {
  if (!task.date || task.repeat === 'none') return [task]
  const seriesId = task.seriesId || uid()
  const first = { ...task, seriesId }
  const instances = [first]
  let cursor = first
  const horizon = addMonths(parseISO(task.date), 3)
  for (let index = 0; index < 100; index += 1) {
    const date = nextRepeatDate(cursor)
    if (!date || parseISO(date) > horizon) break
    cursor = { ...first, date }
    instances.push({ ...cursor, id: uid(), createdAt: Date.now() + index + 1 })
  }
  return instances
}

function normalizeRecurringTasks(tasks: Task[]) {
  return tasks.flatMap((task) => task.repeat !== 'none' && !task.seriesId ? expandRecurrences(task) : [task])
}

export default function KinvenApp() {
  const stored = useMemo(() => {
    try {
      const current = localStorage.getItem(STORE)
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
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
    const current = localStorage.getItem(THEME_STORE)
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
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const inboxTasks = tasks.filter((task) => !task.date && !task.completed)
  const visibleTasks = useMemo(() => {
    let result = tasks
    if (view === 'inbox') result = tasks.filter((t) => !t.date && !t.completed)
    if (view === 'today') result = tasks.filter((t) => t.date === todayKey() && !t.completed)
    if (view === 'upcoming') result = tasks.filter((t) => !!t.date && t.date > todayKey() && !t.completed)
    if (view === 'completed') result = tasks.filter((t) => t.completed)
    if (view === 'incomplete') result = tasks.filter((t) => !t.completed)
    if (view.startsWith('group:')) result = tasks.filter((t) => t.groupId === view.slice(6) && !t.completed)
    if (search.trim()) result = result.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    return [...result].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.startMinutes - b.startMinutes)
  }, [tasks, view, search])
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
    setTasks((items) => items.map((item) => item.id === id
      ? {
          ...item,
          completed: complete,
          date: item.date,
          startMinutes: item.startMinutes,
          groupId: item.groupId,
        }
      : item))
    setToast(complete ? 'Moved to Completed' : 'Marked incomplete')
  }
  const removeTask = useCallback((id: string) => {
    const task = tasks.find((item) => item.id === id)
    if (task?.seriesId && tasks.some((item) => item.id !== id && item.seriesId === task.seriesId)) {
      setPendingSeriesAction({ kind: 'delete', task })
      return
    }
    setTasks((items) => items.filter((item) => item.id !== id))
    setEditingTask(null)
  }, [tasks])
  const applySeriesAction = (scope: RecurrenceScope) => {
    if (!pendingSeriesAction) return
    const base = pendingSeriesAction.kind === 'edit' ? pendingSeriesAction.original : pendingSeriesAction.task
    const isIncluded = (task: Task) => {
      if (scope === 'only') return task.id === base.id
      if (!base.seriesId || task.seriesId !== base.seriesId) return false
      const taskOrder = task.date || String(task.createdAt)
      const baseOrder = base.date || String(base.createdAt)
      if (scope === 'past') return taskOrder <= baseOrder
      if (scope === 'future') return taskOrder >= baseOrder
      return true
    }
    if (pendingSeriesAction.kind === 'delete') {
      setTasks((items) => items.filter((task) => !isIncluded(task)))
    } else {
      const { original, next } = pendingSeriesAction
      const dateShift = original.date && next.date
        ? differenceInCalendarDays(parseISO(next.date), parseISO(original.date))
        : 0
      setTasks((items) => items.map((task) => {
        if (!isIncluded(task)) return task
        if (scope === 'only') return next.repeat === 'none' ? { ...next, seriesId: undefined } : next
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
        }
      }))
    }
    setPendingSeriesAction(null)
    setEditingTask(null)
    setCreatingTask(null)
    setToast(pendingSeriesAction.kind === 'delete' ? 'Recurring tasks deleted' : 'Recurring tasks updated')
  }
  const createQuickTask = () => {
    if (!quickTitle.trim()) return
    const titles = quickTitle.split(';').map((title) => title.trim()).filter(Boolean)
    setTasks((items) => [...items, ...titles.map((title) => ({
      id: uid(), title, notes: '', groupId: view.startsWith('group:') ? view.slice(6) : null,
      date: view === 'today' ? todayKey() : null, startMinutes: 540, duration: 30,
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
  const batch = (action: 'complete' | 'delete' | 'inbox') => {
    if (action === 'delete') {
      const recurring = tasks.find((task) => selected.has(task.id) && task.seriesId)
      if (recurring) {
        setPendingSeriesAction({ kind: 'delete', task: recurring })
        return
      }
    }
    setTasks((items) => items
      .filter((task) => action !== 'delete' || !selected.has(task.id))
      .map((task) => !selected.has(task.id) ? task : action === 'complete'
        ? { ...task, completed: true }
        : action === 'inbox' ? { ...task, date: null } : task))
    setSelected(new Set())
  }
  const openScheduledTask = (date: Date, startMinutes = 540) =>
    setCreatingTask({ date: dateToKey(date), startMinutes, duration: 30 })
  const scheduleDroppedTask = (taskId: string, day: Date, clientY: number, rect: DOMRect) => {
    const raw = 420 + ((clientY - rect.top) / rect.height) * 780
    const snapped = Math.max(420, Math.min(1170, Math.round(raw / 15) * 15))
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
      if (event.key === 'Escape') {
        if (zoning.current) {
          updateTask(zoning.current.task)
          zoning.current = null
          setToast('Placement cancelled')
        }
        setEditingTask(null); setCreatingTask(null); setEditingGroup(null); setEditingSection('general')
        setCommandPalette(false); setShortcutHelp(false); setFocusSubtask(false); setPendingSeriesAction(null); setDeletingTask(null)
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
          else updateTask({ ...current, startMinutes: Math.max(420, Math.min(1185, current.startMinutes + delta)) })
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
  }, [activeTaskId, autoExtend, commandPalette, creatingTask, editingGroup, editingTask, focusMode, focusTask, groups, hoveredTask, inboxTasks, now, removeTask, shortcutHelp, tasks, view, visibleTasks])

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

  return <div className="app-shell" onMouseOver={(event) => {
    const taskElement = (event.target as HTMLElement).closest<HTMLElement>('[data-task-id]')
    setHoveredTaskId(taskElement?.dataset.taskId || null)
  }} onMouseLeave={() => setHoveredTaskId(null)}>
    <header className="titlebar">
      <div className="traffic-lights"><i /><i /><i /></div>
      <nav>
        <button className={view !== 'calendar' ? 'active' : ''} onClick={() => setView('today')}>Tasks</button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendar</button>
      </nav>
      <button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
    </header>

    <div className="workspace">
      <aside className="sidebar">
        <div className="search-box"><Search size={15} /><input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" /></div>
        <SidebarButton icon={<Inbox />} label="Inbox" count={inboxTasks.length} active={view === 'inbox'} onClick={() => setView('inbox')} />
        <SidebarButton icon={<CalendarDays />} label="Today" count={tasks.filter((t) => t.date === todayKey() && !t.completed).length} active={view === 'today'} onClick={() => setView('today')} />
        <SidebarButton icon={<Clock3 />} label="Upcoming" count={tasks.filter((t) => !!t.date && t.date > todayKey() && !t.completed).length} active={view === 'upcoming'} onClick={() => setView('upcoming')} />
        <SidebarButton icon={<CheckCircle2 />} label="Completed" count={tasks.filter((t) => t.completed).length} active={view === 'completed'} onClick={() => setView('completed')} />
        <div className="section-title"><span>Groups</span><button onClick={() => setEditingGroup({ id: '', title: '', color: COLORS[0] })}><Plus size={15} /></button></div>
        {groups.map((group) => <div className={`group-row ${view === `group:${group.id}` ? 'active' : ''}`} key={group.id}>
          <button className="group-link" onClick={() => setView(`group:${group.id}`)}>
            <span className="color-dot" style={{ background: group.color }} /><span>{group.title}</span>
            <b>{tasks.filter((t) => t.groupId === group.id && !t.completed).length}</b>
          </button>
          <button className="group-edit" onClick={() => setEditingGroup(group)}><MoreHorizontal size={15} /></button>
        </div>)}
        <button className="sidebar-new" onClick={() => setCreatingTask({})}><Plus size={16} /> New task</button>
        <div className="local-badge"><Archive size={14} /> Saved locally</div>
      </aside>

      {view === 'calendar' ? <main className="calendar-view">
        <section className="planning-pane" data-inbox-drop onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
          const taskId = event.dataTransfer.getData('taskId')
          if (taskId) setTasks((items) => items.map((task) => task.id === taskId ? { ...task, date: null } : task))
        }}>
          <div className="pane-heading"><div><span className="eyebrow">Planning</span><h2>Inbox</h2></div><button className="icon-button" onClick={() => setCreatingTask({})}><Plus /></button></div>
          <div className="quick-create"><input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createQuickTask()} placeholder="New task" /><kbd>N</kbd></div>
          <p className="drag-hint">Drag a task onto the calendar to schedule it.</p>
          <div className="backlog">
            {inboxTasks.map((task) => <TaskRow task={task} group={task.groupId ? groupMap.get(task.groupId) : undefined} active={activeTaskId === task.id} key={task.id} onEdit={() => { setActiveTaskId(task.id); setEditingTask(task) }} onComplete={() => completeTask(task.id)} draggable />)}
            {!inboxTasks.length && <EmptyState title="Inbox zero" copy="Everything has a place." />}
          </div>
          <div className="inbox-drop-hint"><Inbox /> Drop calendar tasks here to unschedule</div>
        </section>
        <section className="calendar-pane">
          <CalendarToolbar anchor={anchor} range={range} setRange={setRange} move={(n) => setAnchor((d) => range === 'month' ? addMonths(d, n) : addDays(d, n * (range as number)))} reset={() => setAnchor(new Date())} />
          {range === 'month'
            ? <MonthCalendar days={calendarDays} anchor={anchor} tasks={tasks} groupMap={groupMap} onTask={(task) => { setActiveTaskId(task.id); setEditingTask(task) }} onDay={openScheduledTask} />
            : <TimeCalendar days={calendarDays} tasks={tasks} groupMap={groupMap} onTask={(task) => { setActiveTaskId(task.id); setEditingTask(task) }} onEmpty={openScheduledTask} onDrop={scheduleDroppedTask} updateTask={updateTask} completeTask={completeTask} zoom={calendarZoom} activeTaskId={activeTaskId} />}
        </section>
      </main> : <main className="list-view">
        <div className="list-header">
          <div><span className="eyebrow">Tasks</span><h1>{view.startsWith('group:') ? groupMap.get(view.slice(6))?.title : view[0].toUpperCase() + view.slice(1)}</h1><p>{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}</p></div>
          <button className="primary" onClick={() => setCreatingTask({ groupId: view.startsWith('group:') ? view.slice(6) : null, date: view === 'today' ? todayKey() : null })}><Plus size={17} /> Add task</button>
        </div>
        <div className="quick-create large"><input autoFocus value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createQuickTask()} placeholder="Type tasks separated by semicolons, then press Enter…" /><span>Quick add</span></div>
        {selected.size > 0 && <div className="batch-bar"><b>{selected.size} selected</b><button onClick={() => batch('complete')}><Check /> Complete</button><button onClick={() => batch('inbox')}><Inbox /> Move to inbox</button><button className="danger-text" onClick={() => batch('delete')}><Trash2 /> Delete</button><button onClick={() => setSelected(new Set())}><X /></button></div>}
        <div className="task-list">
          {visibleTasks.map((task) => <div className={`list-task ${selected.has(task.id) ? 'selected' : ''}`} key={task.id}>
            <button className="select-box" onClick={() => setSelected((set) => {
              const next = new Set(set)
              if (next.has(task.id)) next.delete(task.id)
              else next.add(task.id)
              return next
            })}>{selected.has(task.id) && <Check size={13} />}</button>
            <TaskRow task={task} group={task.groupId ? groupMap.get(task.groupId) : undefined} active={activeTaskId === task.id} onEdit={() => { setActiveTaskId(task.id); setEditingTask(task) }} onComplete={() => completeTask(task.id, !task.completed)} />
          </div>)}
          {!visibleTasks.length && <EmptyState title="All clear" copy="Nothing needs your attention here." />}
        </div>
      </main>}
    </div>

    {(editingTask || creatingTask) && <TaskModal key={editingTask?.id || 'new-task'} task={editingTask} draft={creatingTask} groups={groups} initialSection={editingTask ? editingSection : 'general'} onCreateGroup={(group) => setGroups((items) => [...items, group])} onClose={() => { setEditingTask(null); setCreatingTask(null); setEditingSection('general') }} onDelete={(id) => {
      const task = tasks.find((item) => item.id === id)
      if (task) setDeletingTask(task)
    }} onSave={(task) => {
      if (editingTask?.seriesId && tasks.some((item) => item.id !== editingTask.id && item.seriesId === editingTask.seriesId)) {
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
  </div>
}

function SidebarButton({ icon, label, count, active, onClick }: { icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void }) {
  return <button className={`sidebar-button ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}{label}</span>{count > 0 && <b>{count}</b>}</button>
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
    <div className="recurrence-modal">
      <div className="modal-title"><div><span className="eyebrow">Recurring task</span><h2>{kind === 'edit' ? 'Which tasks should change?' : 'Which tasks should be deleted?'}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div>
      <p>This task belongs to a repeating series. Choose the range before continuing.</p>
      <div className="scope-options">
        <button onClick={() => onChoose('only')}><strong>This task only</strong><span>{verb} this occurrence without affecting the rest.</span></button>
        <button onClick={() => onChoose('past')}><strong>This and all previous tasks</strong><span>{verb} this occurrence and every earlier occurrence.</span></button>
        <button onClick={() => onChoose('future')}><strong>This and all future tasks</strong><span>{verb} this occurrence and every later occurrence.</span></button>
        <button className={kind === 'delete' ? 'danger-option' : ''} onClick={() => onChoose('all')}><strong>All previous and future tasks</strong><span>{verb} the entire repeating series.</span></button>
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
      <div><button onClick={onClose}>Cancel</button><button className="confirm-delete" onClick={onConfirm}>Delete task</button></div>
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

function TaskRow({ task, group, onEdit, onComplete, draggable = false, active = false }: { task: Task; group?: Group; onEdit: () => void; onComplete: () => void; draggable?: boolean; active?: boolean }) {
  return <div data-task-id={task.id} className={`task-row ${task.completed ? 'done' : ''} ${active ? 'keyboard-active' : ''}`} draggable={draggable} onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)} onClick={onEdit}>
    <button className="check-button" onClick={(e) => { e.stopPropagation(); onComplete() }}>{task.completed ? <Check /> : <Circle />}</button>
    <div className="task-copy"><strong>{task.title}</strong><span>{group && <><i style={{ background: group.color }} />{group.title}</>}{task.date && ` · ${format(parseISO(task.date), 'MMM d')}`}{task.date && ` · ${minutesToTime(task.startMinutes)}`}</span></div>
    <span className="duration">{task.repeat !== 'none' && <Repeat2 size={12} />}{task.duration}m</span>
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

function TimeCalendar({ days, tasks, groupMap, onTask, onEmpty, onDrop, updateTask, completeTask, zoom, activeTaskId }: {
  days: Date[]; tasks: Task[]; groupMap: Map<string, Group>; onTask: (task: Task) => void
  onEmpty: (day: Date, startMinutes: number) => void; onDrop: (id: string, day: Date, y: number, rect: DOMRect) => void
  updateTask: (task: Task) => void; completeTask: (id: string, complete?: boolean) => void; zoom: number; activeTaskId: string | null
}) {
  const startHour = 7
  const hours = Array.from({ length: 14 }, (_, i) => i + startHour)
  return <div className="time-calendar">
    <div className="day-headers" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(90px, 1fr))` }}><div />{days.map((day) => <div className={isToday(day) ? 'today' : ''} key={day.toString()}><span>{format(day, 'EEE')}</span><b>{format(day, 'd')}</b></div>)}</div>
    <div className="time-grid" style={{ minHeight: `${780 * zoom}px` }}>
      <div className="hours">{hours.map((hour) => <span key={hour}>{format(new Date(2020, 1, 1, hour), 'h a')}</span>)}</div>
      {days.map((day) => <div className="day-column" data-date={dateToKey(day)} key={day.toString()} onDoubleClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onEmpty(day, Math.round((420 + ((e.clientY - rect.top) / rect.height) * 780) / 15) * 15)
      }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e.dataTransfer.getData('taskId'), day, e.clientY, e.currentTarget.getBoundingClientRect())}>
        {hours.map((hour) => <i className="hour-line" style={{ top: `${((hour - startHour) / 13) * 100}%` }} key={hour} />)}
        {tasks.filter((t) => t.date === dateToKey(day)).map((task) => {
          const group = task.groupId ? groupMap.get(task.groupId) : undefined
          return <CalendarTask task={task} color={group?.color || '#6f7785'} active={activeTaskId === task.id} onTask={onTask} updateTask={updateTask} completeTask={completeTask} key={task.id} />
        })}
      </div>)}
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
  const top = ((task.startMinutes - 420) / 780) * 100
  const minimumHeight = task.duration <= 15 ? 2.5 : task.duration <= 30 ? 3.85 : 4.6
  const height = Math.max(minimumHeight, (task.duration / 780) * 100)

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
            const rawMinutes = 420 + ((e.clientY - rect.top) / rect.height) * 780
            const startMinutes = Math.max(420, Math.min(1200 - task.duration, Math.round(rawMinutes / 15) * 15))
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
    start.current = { y: e.clientY, duration: task.duration, pixelsPerMinute: (column?.getBoundingClientRect().height || 780) / 780 }
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

'use client'

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  addTodoGroup, addTodoTask, toggleTodoTask,
  renameTodoItem, deleteTodoGroup, deleteTodoTask, reorderTodoItems,
} from '../../actions'
import { GripVertical, Plus, CheckSquare, Square, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type TodoGroup = {
  id: string
  projectId: string
  deliverableId: string | null
  title: string
  position: number
}

type TodoTask = {
  id: string
  projectId: string
  groupId: string | null
  title: string
  completed: boolean | null
  position: number
}

type Deliverable = {
  id: string
  name: string
  additionalFormats: number | null
}

type ContextMenuState = {
  x: number
  y: number
  type: 'group' | 'task'
  id: string
  title: string
  groupId?: string | null
}

const DEFAULT_TASK_TITLES = ['First Draft', 'Revision', 'Colour Grade', 'Sound', 'Finishing', 'Masters', 'Upload']

// ─── Sortable wrappers ────────────────────────────────────────────────────────

function SortableItem({ id, children }: { id: string; children: (props: { dragHandleProps: object; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  )
}

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({
  task,
  projectId,
  dragHandleProps,
  onContextMenu,
  onToggle,
}: {
  task: TodoTask
  projectId: string
  dragHandleProps?: object
  onContextMenu: (e: React.MouseEvent) => void
  onToggle: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-700/50 group"
      onContextMenu={onContextMenu}
    >
      {dragHandleProps && (
        <span {...dragHandleProps} className="cursor-grab text-gray-600 hover:text-gray-400 shrink-0 touch-none">
          <GripVertical size={14} />
        </span>
      )}
      <button onClick={onToggle} className="shrink-0 text-gray-400 hover:text-white transition-colors">
        {(task.completed ?? false) ? <CheckSquare size={15} className="text-emerald-400" /> : <Square size={15} />}
      </button>
      <span className={`text-sm flex-1 ${(task.completed ?? false) ? 'line-through text-gray-500' : 'text-gray-200'}`}>
        {task.title}
      </span>
    </div>
  )
}

// ─── Group Card ───────────────────────────────────────────────────────────────

function GroupCard({
  group,
  tasks,
  projectId,
  dragHandleProps,
  onGroupContextMenu,
  onTaskContextMenu,
  onToggleTask,
  onAddTask,
  onAddDefaultTasks,
}: {
  group: TodoGroup
  tasks: TodoTask[]
  projectId: string
  dragHandleProps?: object
  onGroupContextMenu: (e: React.MouseEvent) => void
  onTaskContextMenu: (e: React.MouseEvent, task: TodoTask) => void
  onToggleTask: (taskId: string) => void
  onAddTask: (groupId: string) => void
  onAddDefaultTasks: (groupId: string, deliverableId: string, existingTasks: TodoTask[]) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const completedCount = tasks.filter(t => t.completed ?? false).length
  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position)
  const taskIds = sortedTasks.map(t => `tsk-${t.id}`)

  const hasVariations = group.deliverableId !== null
  const defaultTitles = hasVariations ? [...DEFAULT_TASK_TITLES, 'Variations'] : DEFAULT_TASK_TITLES
  const existingTitles = new Set(tasks.map(t => t.title))
  const allDefaultsPresent = defaultTitles.every(t => existingTitles.has(t))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      {/* Group header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700 bg-gray-750"
        onContextMenu={onGroupContextMenu}
      >
        {dragHandleProps && (
          <span {...dragHandleProps} className="cursor-grab text-gray-600 hover:text-gray-400 shrink-0 touch-none">
            <GripVertical size={14} />
          </span>
        )}
        <button onClick={() => setCollapsed(c => !c)} className="text-gray-400 hover:text-white shrink-0">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="font-medium text-white text-sm flex-1">{group.title}</span>
        <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-700 rounded">
          {completedCount}/{tasks.length}
        </span>
        {group.deliverableId && (
          <button
            onClick={() => onAddDefaultTasks(group.id, group.deliverableId!, tasks)}
            disabled={allDefaultsPresent}
            title="Add default tasks"
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            Defaults
          </button>
        )}
        <button
          onClick={() => onAddTask(group.id)}
          className="text-gray-400 hover:text-white shrink-0 transition-colors"
          title="Add task"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Tasks */}
      {!collapsed && (
        <div className="py-1">
          {sortedTasks.length === 0 ? (
            <p className="text-xs text-gray-600 px-3 py-2 italic">No tasks yet — add one above</p>
          ) : (
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              {sortedTasks.map(task => (
                <SortableItem key={task.id} id={`tsk-${task.id}`}>
                  {({ dragHandleProps: dh }) => (
                    <TaskItem
                      task={task}
                      projectId={projectId}
                      dragHandleProps={dh}
                      onContextMenu={e => onTaskContextMenu(e, task)}
                      onToggle={() => onToggleTask(task.id)}
                    />
                  )}
                </SortableItem>
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function TodoClient({
  projectId,
  projectName,
  deliverables,
  initialGroups,
  initialTasks,
}: {
  projectId: string
  projectName: string
  deliverables: Deliverable[]
  initialGroups: TodoGroup[]
  initialTasks: TodoTask[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Local state for optimistic drag updates
  const [groups, setGroups] = useState(() => [...initialGroups].sort((a, b) => a.position - b.position))
  const [tasks, setTasks] = useState(initialTasks)

  // Sync when server data changes
  useEffect(() => { setGroups([...initialGroups].sort((a, b) => a.position - b.position)) }, [initialGroups])
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  useEffect(() => {
    function closeMenu() { setContextMenu(null) }
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [])

  // Dialogs
  const [addDeliverablesOpen, setAddDeliverablesOpen] = useState(false)
  const [selectedDeliverableIds, setSelectedDeliverableIds] = useState<Set<string>>(new Set())

  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [addTaskGroupId, setAddTaskGroupId] = useState<string | null>(null)
  const [addTaskTitle, setAddTaskTitle] = useState('')

  const [defaultTasksOpen, setDefaultTasksOpen] = useState(false)
  const [defaultTasksGroupId, setDefaultTasksGroupId] = useState<string | null>(null)
  const [defaultTasksDeliverableId, setDefaultTasksDeliverableId] = useState<string | null>(null)
  const [defaultTasksExisting, setDefaultTasksExisting] = useState<Set<string>>(new Set())
  const [selectedDefaults, setSelectedDefaults] = useState<Set<string>>(new Set())

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameTarget, setRenameTarget] = useState<{ id: string; type: 'group' | 'task' } | null>(null)

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Top-level items (groups + standalone tasks) sorted by position
  const topLevelItems = useMemo(() => {
    const grpItems = groups.map(g => ({ id: `grp-${g.id}`, kind: 'group' as const, position: g.position, group: g }))
    const standalone = tasks.filter(t => !t.groupId).map(t => ({ id: `tsk-${t.id}`, kind: 'task' as const, position: t.position, task: t }))
    return [...grpItems, ...standalone].sort((a, b) => a.position - b.position)
  }, [groups, tasks])

  const topLevelIds = topLevelItems.map(i => i.id)

  // Which deliverables already have a group
  const groupedDeliverableIds = new Set(groups.map(g => g.deliverableId).filter(Boolean))
  const allDeliverablesAdded = deliverables.length > 0 && deliverables.every(d => groupedDeliverableIds.has(d.id))

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleGroupContextMenu(e: React.MouseEvent, group: TodoGroup) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'group', id: group.id, title: group.title })
  }

  function handleTaskContextMenu(e: React.MouseEvent, task: TodoTask) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'task', id: task.id, title: task.title, groupId: task.groupId })
  }

  function openAddTask(groupId: string | null) {
    setAddTaskGroupId(groupId)
    setAddTaskTitle('')
    setAddTaskOpen(true)
  }

  function openDefaultTasks(groupId: string, deliverableId: string, existingTasks: TodoTask[]) {
    const deliverable = deliverables.find(d => d.id === deliverableId)
    const titles = [...DEFAULT_TASK_TITLES]
    if (deliverable && (deliverable.additionalFormats ?? 0) > 0) titles.push('Variations')
    const existingTitles = new Set(existingTasks.map(t => t.title))
    setDefaultTasksGroupId(groupId)
    setDefaultTasksDeliverableId(deliverableId)
    setDefaultTasksExisting(existingTitles)
    setSelectedDefaults(new Set())
    setDefaultTasksOpen(true)
  }

  function openRename() {
    if (!contextMenu) return
    setRenameTarget({ id: contextMenu.id, type: contextMenu.type })
    setRenameValue(contextMenu.title)
    setContextMenu(null)
    setRenameOpen(true)
  }

  function handleDelete() {
    if (!contextMenu) return
    const { id, type } = contextMenu
    setContextMenu(null)
    startTransition(async () => {
      if (type === 'group') {
        await deleteTodoGroup(id, projectId)
      } else {
        await deleteTodoTask(id, projectId)
      }
      router.refresh()
    })
  }

  function handleToggleTask(taskId: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !(t.completed ?? false) } : t))
    startTransition(async () => {
      await toggleTodoTask(taskId, projectId)
      router.refresh()
    })
  }

  function handleAddDeliverables() {
    startTransition(async () => {
      for (const delId of selectedDeliverableIds) {
        const del = deliverables.find(d => d.id === delId)
        if (del) await addTodoGroup(projectId, del.name, del.id)
      }
      setAddDeliverablesOpen(false)
      setSelectedDeliverableIds(new Set())
      router.refresh()
    })
  }

  function handleAddTask() {
    const title = addTaskTitle.trim()
    if (!title) return
    startTransition(async () => {
      await addTodoTask(projectId, title, addTaskGroupId ?? undefined)
      setAddTaskOpen(false)
      setAddTaskTitle('')
      router.refresh()
    })
  }

  function handleAddDefaultTasks() {
    if (!defaultTasksGroupId || !defaultTasksDeliverableId) return
    startTransition(async () => {
      const deliverable = deliverables.find(d => d.id === defaultTasksDeliverableId)
      const allTitles = [...DEFAULT_TASK_TITLES]
      if (deliverable && (deliverable.additionalFormats ?? 0) > 0) allTitles.push('Variations')
      const toAdd = allTitles.filter(t => selectedDefaults.has(t))
      for (const title of toAdd) {
        await addTodoTask(projectId, title, defaultTasksGroupId)
      }
      setDefaultTasksOpen(false)
      router.refresh()
    })
  }

  function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    startTransition(async () => {
      await renameTodoItem(renameTarget.id, renameTarget.type, renameValue.trim(), projectId)
      setRenameOpen(false)
      router.refresh()
    })
  }

  // ─── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeStr = String(active.id)
    const overStr = String(over.id)
    const isGroupDrag = activeStr.startsWith('grp-')

    if (isGroupDrag) {
      // Top-level reorder (groups and standalone tasks together)
      const oldIndex = topLevelIds.indexOf(activeStr)
      const newIndex = topLevelIds.indexOf(overStr)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(topLevelItems, oldIndex, newIndex)
      const updates = reordered.map((item, idx) => ({
        id: item.kind === 'group' ? item.group.id : item.task.id,
        type: item.kind === 'group' ? 'group' as const : 'task' as const,
        position: idx + 1,
      }))
      setGroups(prev => {
        const updated = [...prev]
        for (const u of updates.filter(u => u.type === 'group')) {
          const g = updated.find(g => g.id === u.id)
          if (g) g.position = u.position
        }
        return updated.sort((a, b) => a.position - b.position)
      })
      setTasks(prev => prev.map(t => {
        const u = updates.find(u => u.type === 'task' && u.id === t.id)
        return u ? { ...t, position: u.position } : t
      }))
      startTransition(async () => {
        await reorderTodoItems(projectId, updates)
        router.refresh()
      })
    } else if (activeStr.startsWith('tsk-')) {
      // Task drag — within group or standalone
      const taskId = activeStr.replace('tsk-', '')
      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      if (task.groupId) {
        const groupTasks = tasks.filter(t => t.groupId === task.groupId).sort((a, b) => a.position - b.position)
        const oldIdx = groupTasks.findIndex(t => `tsk-${t.id}` === activeStr)
        const newIdx = groupTasks.findIndex(t => `tsk-${t.id}` === overStr)
        if (oldIdx === -1 || newIdx === -1) return
        const reordered = arrayMove(groupTasks, oldIdx, newIdx)
        const updates = reordered.map((t, idx) => ({ id: t.id, type: 'task' as const, position: idx + 1, groupId: task.groupId ?? undefined }))
        setTasks(prev => {
          const others = prev.filter(t => t.groupId !== task.groupId)
          return [...others, ...reordered.map((t, idx) => ({ ...t, position: idx + 1 }))]
        })
        startTransition(async () => {
          await reorderTodoItems(projectId, updates)
          router.refresh()
        })
      } else {
        const standalone = tasks.filter(t => !t.groupId).sort((a, b) => a.position - b.position)
        const oldIdx = standalone.findIndex(t => `tsk-${t.id}` === activeStr)
        const newIdx = topLevelIds.indexOf(overStr)
        if (oldIdx === -1 || newIdx === -1) return
        const reordered = arrayMove(standalone, oldIdx, standalone.findIndex(t => `tsk-${t.id}` === overStr))
        const updates = reordered.map((t, idx) => ({ id: t.id, type: 'task' as const, position: idx + 1 }))
        setTasks(prev => {
          const grouped = prev.filter(t => t.groupId)
          return [...grouped, ...reordered.map((t, idx) => ({ ...t, position: idx + 1 }))]
        })
        startTransition(async () => {
          await reorderTodoItems(projectId, updates)
          router.refresh()
        })
      }
    }
  }

  // ─── Active drag preview ────────────────────────────────────────────────────

  const activeGroup = activeId?.startsWith('grp-') ? groups.find(g => `grp-${g.id}` === activeId) : null
  const activeTask = activeId?.startsWith('tsk-') ? tasks.find(t => `tsk-${t.id}` === activeId) : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = topLevelItems.length === 0

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm text-gray-400 flex-1">{projectName}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedDeliverableIds(new Set())
            setAddDeliverablesOpen(true)
          }}
          disabled={deliverables.length === 0 || allDeliverablesAdded}
        >
          <Plus size={14} /> Add Deliverables
        </Button>
        <Button variant="outline" size="sm" onClick={() => openAddTask(null)}>
          <Plus size={14} /> Add Task
        </Button>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-500 text-sm">No tasks yet.</p>
          <p className="text-gray-600 text-xs mt-1">Add a deliverable or create a standalone task to get started.</p>
        </div>
      )}

      {/* Sortable list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {topLevelItems.map(item => {
              if (item.kind === 'group') {
                const groupTasks = tasks.filter(t => t.groupId === item.group.id)
                return (
                  <SortableItem key={item.id} id={item.id}>
                    {({ dragHandleProps }) => (
                      <GroupCard
                        group={item.group}
                        tasks={groupTasks}
                        projectId={projectId}
                        dragHandleProps={dragHandleProps}
                        onGroupContextMenu={e => handleGroupContextMenu(e, item.group)}
                        onTaskContextMenu={handleTaskContextMenu}
                        onToggleTask={handleToggleTask}
                        onAddTask={openAddTask}
                        onAddDefaultTasks={openDefaultTasks}
                      />
                    )}
                  </SortableItem>
                )
              }
              return (
                <SortableItem key={item.id} id={item.id}>
                  {({ dragHandleProps }) => (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg">
                      <TaskItem
                        task={item.task}
                        projectId={projectId}
                        dragHandleProps={dragHandleProps}
                        onContextMenu={e => handleTaskContextMenu(e, item.task)}
                        onToggle={() => handleToggleTask(item.task.id)}
                      />
                    </div>
                  )}
                </SortableItem>
              )
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeGroup && (
            <div className="bg-gray-800 border border-blue-500/50 rounded-lg px-3 py-2.5 shadow-xl opacity-90">
              <span className="font-medium text-white text-sm">{activeGroup.title}</span>
            </div>
          )}
          {activeTask && (
            <div className="bg-gray-800 border border-blue-500/50 rounded-lg px-3 py-2 shadow-xl opacity-90">
              <span className="text-sm text-gray-200">{activeTask.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={openRename}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
          >
            <Edit2 size={13} /> Rename
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700 transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      {/* Add Deliverables dialog */}
      <Dialog open={addDeliverablesOpen} onClose={() => setAddDeliverablesOpen(false)} className="max-w-md">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Deliverables</h2>
          <div className="space-y-2">
            {deliverables.map(d => {
              const alreadyAdded = groupedDeliverableIds.has(d.id)
              return (
                <label
                  key={d.id}
                  className={`flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-colors ${
                    alreadyAdded
                      ? 'border-gray-200 opacity-40 cursor-not-allowed'
                      : selectedDeliverableIds.has(d.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={alreadyAdded}
                    checked={selectedDeliverableIds.has(d.id)}
                    onChange={e => {
                      setSelectedDeliverableIds(prev => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(d.id) : next.delete(d.id)
                        return next
                      })
                    }}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-gray-700">{d.name}</span>
                  {alreadyAdded && <span className="text-xs text-gray-400 ml-auto">Added</span>}
                </label>
              )
            })}
            {deliverables.length === 0 && <p className="text-sm text-gray-500">No deliverables on this project.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddDeliverablesOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDeliverables} disabled={selectedDeliverableIds.size === 0 || isPending}>
              Add Selected
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Task dialog */}
      <Dialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} className="max-w-sm">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {addTaskGroupId ? 'Add Task to Group' : 'Add Standalone Task'}
          </h2>
          <div className="space-y-1.5">
            <Label>Task title</Label>
            <Input
              value={addTaskTitle}
              onChange={e => setAddTaskTitle(e.target.value)}
              placeholder="e.g. Export final cut"
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={!addTaskTitle.trim() || isPending}>Add Task</Button>
          </div>
        </div>
      </Dialog>

      {/* Add Default Tasks dialog */}
      <Dialog open={defaultTasksOpen} onClose={() => setDefaultTasksOpen(false)} className="max-w-sm">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Default Tasks</h2>
          <div className="space-y-2">
            {(() => {
              const deliverable = deliverables.find(d => d.id === defaultTasksDeliverableId)
              const titles = [...DEFAULT_TASK_TITLES]
              if (deliverable && (deliverable.additionalFormats ?? 0) > 0) titles.push('Variations')
              const available = titles.filter(t => !defaultTasksExisting.has(t))
              const allChecked = available.length > 0 && available.every(t => selectedDefaults.has(t))
              return (
                <>
                  <label className="flex items-center gap-3 p-2 rounded border border-gray-200 cursor-pointer hover:border-gray-400 transition-colors">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={e => setSelectedDefaults(e.target.checked ? new Set(available) : new Set())}
                      className="accent-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Check all</span>
                  </label>
                  <div className="border-t border-gray-100" />
                  {titles.map(title => {
                    const alreadyPresent = defaultTasksExisting.has(title)
                    return (
                      <label
                        key={title}
                        className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${
                          alreadyPresent
                            ? 'border-gray-200 opacity-40 cursor-not-allowed'
                            : selectedDefaults.has(title)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={alreadyPresent}
                          checked={selectedDefaults.has(title)}
                          onChange={e => {
                            setSelectedDefaults(prev => {
                              const next = new Set(prev)
                              e.target.checked ? next.add(title) : next.delete(title)
                              return next
                            })
                          }}
                          className="accent-blue-500"
                        />
                        <span className="text-sm text-gray-700">{title}</span>
                        {alreadyPresent && <span className="text-xs text-gray-400 ml-auto">Added</span>}
                      </label>
                    )
                  })}
                </>
              )
            })()}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDefaultTasksOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDefaultTasks} disabled={selectedDefaults.size === 0 || isPending}>
              Add Selected
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} className="max-w-sm">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Rename</h2>
          <div className="space-y-1.5">
            <Label>New name</Label>
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim() || isPending}>Save</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

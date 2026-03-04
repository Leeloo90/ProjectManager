'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
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
} from '../projects/actions'
import {
  GripVertical, Plus, CheckSquare, Square, Trash2, Edit2,
  ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type TodoGroup = {
  id: string; projectId: string; deliverableId: string | null
  title: string; position: number
}

type TodoTask = {
  id: string; projectId: string; groupId: string | null
  title: string; completed: boolean | null; position: number
}

type Deliverable = { id: string; name: string; additionalFormats: number | null; projectId: string }

type ProjectData = {
  id: string; name: string
  deliverables: Deliverable[]
  groups: TodoGroup[]
  tasks: TodoTask[]
}

type ContextMenuState = {
  x: number; y: number; type: 'group' | 'task'; id: string; title: string; groupId?: string | null
}

const DEFAULT_TASK_TITLES = ['First Draft', 'Revision', 'Colour Grade', 'Sound', 'Finishing', 'Masters', 'Upload']

// ─── Sortable wrapper ─────────────────────────────────────────────────────────

function SortableItem({ id, children }: {
  id: string
  children: (props: { dragHandleProps: object }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  )
}

// ─── Task item ────────────────────────────────────────────────────────────────

function TaskItem({ task, dragHandleProps, onContextMenu, onToggle }: {
  task: TodoTask
  dragHandleProps?: object
  onContextMenu: (e: React.MouseEvent) => void
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 group" onContextMenu={onContextMenu}>
      {dragHandleProps && (
        <span {...dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0 touch-none">
          <GripVertical size={14} />
        </span>
      )}
      <button onClick={onToggle} className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
        {(task.completed ?? false) ? <CheckSquare size={15} className="text-emerald-500" /> : <Square size={15} />}
      </button>
      <span className={`text-sm flex-1 ${(task.completed ?? false) ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {task.title}
      </span>
    </div>
  )
}

// ─── Group card ───────────────────────────────────────────────────────────────

function GroupCard({ group, tasks, projectId, projectDeliverables, dragHandleProps, onGroupContextMenu, onTaskContextMenu, onToggleTask, onAddTask, onAddDefaultTasks }: {
  group: TodoGroup; tasks: TodoTask[]; projectId: string; projectDeliverables: Deliverable[]
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

  const defaultTitles = group.deliverableId
    ? (() => {
        const d = projectDeliverables.find(d => d.id === group.deliverableId)
        const t = [...DEFAULT_TASK_TITLES]
        if (d && (d.additionalFormats ?? 0) > 0) t.push('Variations')
        return t
      })()
    : DEFAULT_TASK_TITLES
  const existingTitles = new Set(tasks.map(t => t.title))
  const allDefaultsPresent = group.deliverableId ? defaultTitles.every(t => existingTitles.has(t)) : true

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50" onContextMenu={onGroupContextMenu}>
        {dragHandleProps && (
          <span {...dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0 touch-none">
            <GripVertical size={14} />
          </span>
        )}
        <button onClick={() => setCollapsed(c => !c)} className="text-gray-400 hover:text-gray-600 shrink-0">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="font-medium text-gray-800 text-sm flex-1">{group.title}</span>
        <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-200 rounded">{completedCount}/{tasks.length}</span>
        {group.deliverableId && (
          <button
            onClick={() => onAddDefaultTasks(group.id, group.deliverableId!, tasks)}
            disabled={allDefaultsPresent}
            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-0.5 rounded hover:bg-gray-200 transition-colors"
          >
            Defaults
          </button>
        )}
        <button onClick={() => onAddTask(group.id)} className="text-gray-400 hover:text-gray-700 shrink-0 transition-colors" title="Add task">
          <Plus size={14} />
        </button>
      </div>
      {!collapsed && (
        <div className="py-1">
          {sortedTasks.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2 italic">No tasks yet</p>
          ) : (
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              {sortedTasks.map(task => (
                <SortableItem key={task.id} id={`tsk-${task.id}`}>
                  {({ dragHandleProps: dh }) => (
                    <TaskItem task={task} dragHandleProps={dh} onContextMenu={e => onTaskContextMenu(e, task)} onToggle={() => onToggleTask(task.id)} />
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

// ─── Per-project todo section ─────────────────────────────────────────────────

function ProjectTodoSection({ project }: { project: ProjectData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [groups, setGroups] = useState(() => [...project.groups].sort((a, b) => a.position - b.position))
  const [tasks, setTasks] = useState(project.tasks)

  useEffect(() => { setGroups([...project.groups].sort((a, b) => a.position - b.position)) }, [project.groups])
  useEffect(() => { setTasks(project.tasks) }, [project.tasks])

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  useEffect(() => {
    function close() { setContextMenu(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
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

  const topLevelItems = useMemo(() => {
    const grpItems = groups.map(g => ({ id: `grp-${g.id}`, kind: 'group' as const, position: g.position, group: g }))
    const standalone = tasks.filter(t => !t.groupId).map(t => ({ id: `tsk-${t.id}`, kind: 'task' as const, position: t.position, task: t }))
    return [...grpItems, ...standalone].sort((a, b) => a.position - b.position)
  }, [groups, tasks])

  const topLevelIds = topLevelItems.map(i => i.id)
  const groupedDeliverableIds = new Set(groups.map(g => g.deliverableId).filter(Boolean))
  const allDeliverablesAdded = project.deliverables.length > 0 && project.deliverables.every(d => groupedDeliverableIds.has(d.id))

  // Stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.completed ?? false).length

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function openDefaultTasks(groupId: string, deliverableId: string, existingTasks: TodoTask[]) {
    const d = project.deliverables.find(d => d.id === deliverableId)
    const titles = [...DEFAULT_TASK_TITLES]
    if (d && (d.additionalFormats ?? 0) > 0) titles.push('Variations')
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
      if (type === 'group') await deleteTodoGroup(id, project.id)
      else await deleteTodoTask(id, project.id)
      router.refresh()
    })
  }

  function handleToggleTask(taskId: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !(t.completed ?? false) } : t))
    startTransition(async () => { await toggleTodoTask(taskId, project.id); router.refresh() })
  }

  function handleAddDeliverables() {
    startTransition(async () => {
      for (const delId of selectedDeliverableIds) {
        const d = project.deliverables.find(d => d.id === delId)
        if (d) await addTodoGroup(project.id, d.name, d.id)
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
      await addTodoTask(project.id, title, addTaskGroupId ?? undefined)
      setAddTaskOpen(false)
      setAddTaskTitle('')
      router.refresh()
    })
  }

  function handleAddDefaultTasks() {
    if (!defaultTasksGroupId || !defaultTasksDeliverableId) return
    startTransition(async () => {
      const d = project.deliverables.find(d => d.id === defaultTasksDeliverableId)
      const allTitles = [...DEFAULT_TASK_TITLES]
      if (d && (d.additionalFormats ?? 0) > 0) allTitles.push('Variations')
      const toAdd = allTitles.filter(t => selectedDefaults.has(t))
      for (const title of toAdd) {
        await addTodoTask(project.id, title, defaultTasksGroupId)
      }
      setDefaultTasksOpen(false)
      router.refresh()
    })
  }

  function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    startTransition(async () => {
      await renameTodoItem(renameTarget.id, renameTarget.type, renameValue.trim(), project.id)
      setRenameOpen(false)
      router.refresh()
    })
  }

  // ─── DnD ───────────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) { setActiveId(String(event.active.id)) }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const activeStr = String(active.id)
    const overStr = String(over.id)

    if (activeStr.startsWith('grp-')) {
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
      startTransition(async () => { await reorderTodoItems(project.id, updates); router.refresh() })
    } else if (activeStr.startsWith('tsk-')) {
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
        setTasks(prev => [...prev.filter(t => t.groupId !== task.groupId), ...reordered.map((t, idx) => ({ ...t, position: idx + 1 }))])
        startTransition(async () => { await reorderTodoItems(project.id, updates); router.refresh() })
      } else {
        const standalone = tasks.filter(t => !t.groupId).sort((a, b) => a.position - b.position)
        const oldIdx = standalone.findIndex(t => `tsk-${t.id}` === activeStr)
        const newIdx = standalone.findIndex(t => `tsk-${t.id}` === overStr)
        if (oldIdx === -1 || newIdx === -1) return
        const reordered = arrayMove(standalone, oldIdx, newIdx)
        const updates = reordered.map((t, idx) => ({ id: t.id, type: 'task' as const, position: idx + 1 }))
        setTasks(prev => [...prev.filter(t => t.groupId), ...reordered.map((t, idx) => ({ ...t, position: idx + 1 }))])
        startTransition(async () => { await reorderTodoItems(project.id, updates); router.refresh() })
      }
    }
  }

  const activeGroup = activeId?.startsWith('grp-') ? groups.find(g => `grp-${g.id}` === activeId) : null
  const activeTask = activeId?.startsWith('tsk-') ? tasks.find(t => `tsk-${t.id}` === activeId) : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm"
          onClick={() => { setSelectedDeliverableIds(new Set()); setAddDeliverablesOpen(true) }}
          disabled={project.deliverables.length === 0 || allDeliverablesAdded}
        >
          <Plus size={13} /> Add Deliverables
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setAddTaskGroupId(null); setAddTaskTitle(''); setAddTaskOpen(true) }}>
          <Plus size={13} /> Add Task
        </Button>
      </div>

      {/* List */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {topLevelItems.map(item => {
              if (item.kind === 'group') {
                const groupTasks = tasks.filter(t => t.groupId === item.group.id)
                return (
                  <SortableItem key={item.id} id={item.id}>
                    {({ dragHandleProps }) => (
                      <GroupCard
                        group={item.group} tasks={groupTasks} projectId={project.id}
                        projectDeliverables={project.deliverables}
                        dragHandleProps={dragHandleProps}
                        onGroupContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'group', id: item.group.id, title: item.group.title }) }}
                        onTaskContextMenu={(e, task) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'task', id: task.id, title: task.title, groupId: task.groupId }) }}
                        onToggleTask={handleToggleTask}
                        onAddTask={gid => { setAddTaskGroupId(gid); setAddTaskTitle(''); setAddTaskOpen(true) }}
                        onAddDefaultTasks={openDefaultTasks}
                      />
                    )}
                  </SortableItem>
                )
              }
              return (
                <SortableItem key={item.id} id={item.id}>
                  {({ dragHandleProps }) => (
                    <div className="bg-white border border-gray-200 rounded-lg">
                      <TaskItem task={item.task} dragHandleProps={dragHandleProps}
                        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'task', id: item.task.id, title: item.task.title, groupId: null }) }}
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
          {activeGroup && <div className="bg-white border border-blue-400 rounded-lg px-3 py-2.5 shadow-xl opacity-90 text-sm font-medium text-gray-800">{activeGroup.title}</div>}
          {activeTask && <div className="bg-white border border-blue-400 rounded-lg px-3 py-2 shadow-xl opacity-90 text-sm text-gray-700">{activeTask.title}</div>}
        </DragOverlay>
      </DndContext>

      {/* Context menu */}
      {contextMenu && (
        <div className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={openRename} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <Edit2 size={13} /> Rename
          </button>
          <button onClick={handleDelete} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-500 hover:bg-gray-50 transition-colors">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      {/* Add Deliverables dialog */}
      <Dialog open={addDeliverablesOpen} onClose={() => setAddDeliverablesOpen(false)} className="max-w-md">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Add Deliverables</h2>
          <div className="space-y-2">
            {project.deliverables.map(d => {
              const alreadyAdded = groupedDeliverableIds.has(d.id)
              return (
                <label key={d.id} className={`flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-colors ${alreadyAdded ? 'border-gray-200 opacity-40 cursor-not-allowed' : selectedDeliverableIds.has(d.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}>
                  <input type="checkbox" disabled={alreadyAdded} checked={selectedDeliverableIds.has(d.id)}
                    onChange={e => setSelectedDeliverableIds(prev => { const next = new Set(prev); e.target.checked ? next.add(d.id) : next.delete(d.id); return next })}
                    className="accent-blue-500" />
                  <span className="text-sm text-gray-700">{d.name}</span>
                  {alreadyAdded && <span className="text-xs text-gray-400 ml-auto">Added</span>}
                </label>
              )
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddDeliverablesOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDeliverables} disabled={selectedDeliverableIds.size === 0 || isPending}>Add Selected</Button>
          </div>
        </div>
      </Dialog>

      {/* Add Task dialog */}
      <Dialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} className="max-w-sm">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{addTaskGroupId ? 'Add Task to Group' : 'Add Standalone Task'}</h2>
          <div className="space-y-1.5">
            <Label>Task title</Label>
            <Input value={addTaskTitle} onChange={e => setAddTaskTitle(e.target.value)} placeholder="e.g. Export final cut"
              onKeyDown={e => e.key === 'Enter' && handleAddTask()} autoFocus />
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
          <h2 className="text-lg font-semibold">Add Default Tasks</h2>
          <div className="space-y-2">
            {(() => {
              const d = project.deliverables.find(d => d.id === defaultTasksDeliverableId)
              const titles = [...DEFAULT_TASK_TITLES]
              if (d && (d.additionalFormats ?? 0) > 0) titles.push('Variations')
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
                    const present = defaultTasksExisting.has(title)
                    return (
                      <label key={title} className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${present ? 'border-gray-200 opacity-40 cursor-not-allowed' : selectedDefaults.has(title) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}>
                        <input type="checkbox" disabled={present} checked={selectedDefaults.has(title)}
                          onChange={e => setSelectedDefaults(prev => { const next = new Set(prev); e.target.checked ? next.add(title) : next.delete(title); return next })}
                          className="accent-blue-500" />
                        <span className="text-sm text-gray-700">{title}</span>
                        {present && <span className="text-xs text-gray-400 ml-auto">Added</span>}
                      </label>
                    )
                  })}
                </>
              )
            })()}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDefaultTasksOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDefaultTasks} disabled={selectedDefaults.size === 0 || isPending}>Add Selected</Button>
          </div>
        </div>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} className="max-w-sm">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Rename</h2>
          <div className="space-y-1.5">
            <Label>New name</Label>
            <Input value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus />
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

// ─── Global wrapper ───────────────────────────────────────────────────────────

export function GlobalTodoClient({ projects }: { projects: ProjectData[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-sm">No to-do lists yet.</p>
          <p className="text-gray-500 text-xs mt-1">Open a project and add tasks to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      {projects.map(project => {
        const totalTasks = project.tasks.length
        const completedTasks = project.tasks.filter(t => t.completed ?? false).length
        const isOpen = expanded.has(project.id)

        return (
          <div key={project.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Project header — click to expand */}
            <button
              onClick={() => toggle(project.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-gray-400">
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <span className="font-semibold text-gray-900 flex-1 text-sm">{project.name}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {totalTasks === 0 ? 'No tasks' : `${completedTasks}/${totalTasks} completed`}
              </span>
              <Link
                href={`/projects/${project.id}/todo`}
                onClick={e => e.stopPropagation()}
                className="text-gray-400 hover:text-blue-500 transition-colors shrink-0 ml-1"
                title="Open project to-do"
              >
                <ExternalLink size={13} />
              </Link>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                <ProjectTodoSection project={project} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

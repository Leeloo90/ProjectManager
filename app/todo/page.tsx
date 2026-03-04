import { db } from '@/lib/db'
import { projects, todoGroups, todoTasks, deliverables } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { GlobalTodoClient } from './todo-client'

export default async function GlobalTodoPage() {
  const allGroups = await db.select().from(todoGroups).orderBy(todoGroups.position).all()
  const allTasks = await db.select().from(todoTasks).orderBy(todoTasks.position).all()

  const projectIds = [...new Set([
    ...allGroups.map(g => g.projectId),
    ...allTasks.map(t => t.projectId),
  ])]

  const projectList = projectIds.length > 0
    ? await db.select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, projectIds))
        .all()
    : []

  const allDeliverables = projectIds.length > 0
    ? await db.select({
        id: deliverables.id,
        name: deliverables.name,
        additionalFormats: deliverables.additionalFormats,
        projectId: deliverables.projectId,
      }).from(deliverables)
        .where(inArray(deliverables.projectId, projectIds))
        .all()
    : []

  const projectData = projectList.map(p => ({
    id: p.id,
    name: p.name,
    deliverables: allDeliverables.filter(d => d.projectId === p.id),
    groups: allGroups.filter(g => g.projectId === p.id),
    tasks: allTasks.filter(t => t.projectId === p.id),
  }))

  return (
    <div className="flex flex-col h-full">
      <Topbar title="To Do" />
      <GlobalTodoClient projects={projectData} />
    </div>
  )
}

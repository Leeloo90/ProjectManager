import { db } from '@/lib/db'
import { projects, deliverables } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { getTodoData } from '../../actions'
import { TodoClient } from './todo-client'

export default async function TodoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, id))
    .get()

  if (!project) notFound()

  const projectDeliverables = await db.select({
    id: deliverables.id,
    name: deliverables.name,
    additionalFormats: deliverables.additionalFormats,
  }).from(deliverables).where(eq(deliverables.projectId, id)).orderBy(deliverables.createdAt).all()

  const { groups, tasks } = await getTodoData(id)

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="To Do"
        actions={
          <Link href={`/projects/${id}`}>
            <Button variant="outline"><ChevronLeft size={16} /> Back to Project</Button>
          </Link>
        }
      />
      <TodoClient
        projectId={id}
        projectName={project.name}
        deliverables={projectDeliverables}
        initialGroups={groups}
        initialTasks={tasks}
      />
    </div>
  )
}

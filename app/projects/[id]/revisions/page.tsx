import { db } from '@/lib/db'
import { projects, revisions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { RevisionsClient } from './revisions-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export default async function RevisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
    includedRevisionRounds: projects.includedRevisionRounds,
  }).from(projects).where(eq(projects.id, id)).get()

  if (!project) notFound()

  const projectRevisions = await db.select().from(revisions).where(eq(revisions.projectId, id)).orderBy(revisions.roundNumber).all()

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`${project.name} — Revisions`}
        actions={
          <Link href={`/projects/${id}`}>
            <Button variant="outline"><ChevronLeft size={16} /> Back to Project</Button>
          </Link>
        }
      />
      <RevisionsClient
        projectId={id}
        projectStatus={project.status}
        includedRevisionRounds={project.includedRevisionRounds ?? 2}
        revisions={projectRevisions}
      />
    </div>
  )
}

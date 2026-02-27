import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { FrameioExplorer } from './frameio-explorer'

export default async function FrameioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db
    .select({
      id: projects.id,
      name: projects.name,
      frameioRootFolderId: projects.frameioRootFolderId,
    })
    .from(projects)
    .where(eq(projects.id, id))
    .get()

  if (!project) notFound()
  if (!project.frameioRootFolderId) redirect(`/projects/${id}`)

  return (
    <div className="flex flex-col h-full bg-gray-900 min-h-screen">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-800 gap-1">
            <ChevronLeft size={16} /> Back to project
          </Button>
        </Link>
        <span className="text-gray-500">|</span>
        <span className="text-white font-medium">{project.name}</span>
        <span className="text-gray-500">/</span>
        <span className="text-gray-400">Frame.io</span>
      </div>

      <FrameioExplorer
        rootFolderId={project.frameioRootFolderId}
        projectName={project.name}
        projectId={project.id}
      />
    </div>
  )
}

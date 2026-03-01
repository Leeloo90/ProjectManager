import { db } from '@/lib/db'
import { projects, clients, productionCompanies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, CheckCircle2, XCircle } from 'lucide-react'
import { getFootageByProjectId } from '@/lib/actions/footage'
import { getGoogleAuthStatus } from '@/lib/actions/google-auth'
import { FootageClient } from './footage-client'

export default async function FootagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientName: clients.name,
      companyName: productionCompanies.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
    .where(eq(projects.id, id))
    .get()

  if (!project) notFound()

  const [footage, { connected }] = await Promise.all([
    getFootageByProjectId(id),
    getGoogleAuthStatus(),
  ])

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
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{project.name}</span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400">Footage</span>
        </div>
        <div className="ml-auto">
          {connected ? (
            <div className="flex items-center gap-2 text-green-400" title="Google Drive connected">
              <CheckCircle2 size={16} /> 
            </div>
          ) : (
            <Link href="/settings?tab=integrations" title="Google Drive not connected. Click to connect.">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle size={16} />
              </div>
            </Link>
          )}
        </div>
      </div>

      <FootageClient
        projectId={project.id}
        projectName={project.name}
        googleConnected={connected}
        footage={footage ?? null}
      />
    </div>
  )
}


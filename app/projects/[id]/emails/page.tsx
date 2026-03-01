import { db } from '@/lib/db'
import { projects, googleAuth, productionCompanies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { EmailListClient } from './email-list-client'

export default async function ProjectEmailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db
    .select({
      id: projects.id,
      name: projects.name,
      companyName: productionCompanies.name,
    })
    .from(projects)
    .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
    .where(eq(projects.id, id))
    .get()

  if (!project) notFound()

  const authRow = await db
    .select({ refreshToken: googleAuth.refreshToken })
    .from(googleAuth)
    .where(eq(googleAuth.id, 'singleton'))
    .get()

  const isConnected = !!authRow?.refreshToken

  // Build the full Gmail label path: "Company Name/Project Name"
  const labelName = project.companyName
    ? `${project.companyName}/${project.name}`
    : project.name

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`${project.name} — Emails`}
        actions={
          <Link href={`/projects/${id}`}>
            <Button variant="outline"><ChevronLeft size={16} /> Back to Project</Button>
          </Link>
        }
      />
      <EmailListClient
        projectId={id}
        projectName={project.name}
        labelName={labelName}
        isConnected={isConnected}
      />
    </div>
  )
}

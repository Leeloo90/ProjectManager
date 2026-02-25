import { db } from '@/lib/db'
import { projects, clients, productionCompanies, deliverables, shootDetails } from '@/lib/db/schema'
import { eq, sum } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { ProjectsClient } from './projects-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function ProjectsPage() {
  const allProjects = await db.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
    startDate: projects.startDate,
    deadline: projects.deadline,
    clientId: projects.clientId,
    productionCompanyId: projects.productionCompanyId,
    clientName: clients.name,
    companyName: productionCompanies.name,
    invoiceId: projects.invoiceId,
    createdAt: projects.createdAt,
  })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
    .orderBy(projects.deadline)
    .all()

  // Get total costs per project
  const deliverableTotals = await db.select({
    projectId: deliverables.projectId,
  }).from(deliverables).all()

  const shootTotals = await db.select({
    projectId: shootDetails.projectId,
    cost: shootDetails.calculatedShootCost,
  }).from(shootDetails).all()

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Projects"
        actions={
          <Link href="/projects/new">
            <Button><Plus size={16} /> New Project</Button>
          </Link>
        }
      />
      <ProjectsClient projects={allProjects} shootTotals={shootTotals} />
    </div>
  )
}

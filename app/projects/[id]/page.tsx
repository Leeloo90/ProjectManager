import { db } from '@/lib/db'
import { projects, clients, productionCompanies, deliverables, shootDetails, revisions, pricingConfig, businessSettings, } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { ProjectDetailClient } from './project-detail-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, HardDrive, Mail } from 'lucide-react'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
    startDate: projects.startDate,
    deadline: projects.deadline,
    includedRevisionRounds: projects.includedRevisionRounds,
    drivefinalsLink: projects.drivefinalsLink,
    driveArchiveLink: projects.driveArchiveLink,
    notes: projects.notes,
    invoiceId: projects.invoiceId,
    frameioProjectId: projects.frameioProjectId,
    frameioRootFolderId: projects.frameioRootFolderId,
    productionCompanyId: projects.productionCompanyId,
    clientId: projects.clientId,
    clientName: clients.name,
    companyName: productionCompanies.name,
  })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
    .where(eq(projects.id, id))
    .get()

  if (!project) notFound()

  const projectDeliverables = await db.select().from(deliverables).where(eq(deliverables.projectId, id)).orderBy(deliverables.createdAt).all()
  const allShoots = await db.select().from(shootDetails).where(eq(shootDetails.projectId, id)).orderBy(shootDetails.createdAt).all()
  const projectRevisions = await db.select().from(revisions).where(eq(revisions.projectId, id)).orderBy(revisions.roundNumber).all()
  const pricing = await db.select().from(pricingConfig).all()
  const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
  const allCompanies = await db.select().from(productionCompanies).all()
  const allClients = await db.select().from(clients).all()

  const pricingMap = Object.fromEntries(pricing.map(p => [p.configKey, p.configValue]))
  const deliverableTotal = projectDeliverables.reduce((sum, d) => sum + d.calculatedCost, 0)
  const shootTotal = allShoots.reduce((sum, s) => sum + s.calculatedShootCost, 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={project.name}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/projects/${id}/footage`}>
              <Button variant="outline"><HardDrive size={16} /> Footage</Button>
            </Link>
            <Link href={`/projects/${id}/emails`}>
              <Button variant="outline"><Mail size={16} /> Emails</Button>
            </Link>
            <Link href="/projects">
              <Button variant="outline"><ChevronLeft size={16} /> All Projects</Button>
            </Link>
          </div>
        }
      />
      <ProjectDetailClient
        project={project}
        deliverableCount={projectDeliverables.length}
        deliverableTotal={deliverableTotal}
        shootCount={allShoots.length}
        shootTotal={shootTotal}
        revisionCount={projectRevisions.length}
        pricingMap={pricingMap}
        settings={settings ?? null}
        companies={allCompanies}
        clients={allClients}
      />
    </div>
  )
}

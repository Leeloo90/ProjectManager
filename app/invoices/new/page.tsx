import { db } from '@/lib/db'
import { projects, productionCompanies, clients, deliverables, shootDetails, businessSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { NewInvoiceClient } from './new-invoice-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export default async function NewInvoicePage() {
  const finishedProjects = await db.select({
    id: projects.id,
    name: projects.name,
    productionCompanyId: projects.productionCompanyId,
    clientId: projects.clientId,
    clientName: clients.name,
    companyName: productionCompanies.name,
  })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
    .where(eq(projects.status, 'finished'))
    .all()

  const allCompanies = await db.select().from(productionCompanies).all()
  const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()

  // Get costs for each project
  const projectCosts: Record<string, number> = {}
  for (const p of finishedProjects) {
    const deliv = await db.select({ cost: deliverables.calculatedCost }).from(deliverables).where(eq(deliverables.projectId, p.id)).all()
    const shoots = await db.select({ cost: shootDetails.calculatedShootCost }).from(shootDetails).where(eq(shootDetails.projectId, p.id)).all()
    const total = deliv.reduce((sum, d) => sum + d.cost, 0) + shoots.reduce((sum, s) => sum + s.cost, 0)
    projectCosts[p.id] = total
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="New Invoice"
        actions={
          <Link href="/invoices">
            <Button variant="outline"><ChevronLeft size={16} /> Back</Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <NewInvoiceClient
            finishedProjects={finishedProjects}
            companies={allCompanies}
            projectCosts={projectCosts}
            settings={settings}
          />
        </div>
      </div>
    </div>
  )
}

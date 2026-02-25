import { db } from '@/lib/db'
import { invoices, projects, clients, productionCompanies, deliverables, shootDetails, businessSettings } from '@/lib/db/schema'
import { eq, isNull } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { InvoiceDetailClient } from './invoice-detail-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    status: invoices.status,
    invoiceDate: invoices.invoiceDate,
    dueDate: invoices.dueDate,
    poReference: invoices.poReference,
    subtotal: invoices.subtotal,
    vatAmount: invoices.vatAmount,
    total: invoices.total,
    paymentDate: invoices.paymentDate,
    paymentMethod: invoices.paymentMethod,
    paymentReference: invoices.paymentReference,
    lineItemOverrides: invoices.lineItemOverrides,
    productionCompanyId: invoices.productionCompanyId,
    companyName: productionCompanies.name,
    billingAddress: productionCompanies.billingAddress,
    vatNumber: productionCompanies.vatNumber,
    primaryContactName: productionCompanies.primaryContactName,
    primaryContactEmail: productionCompanies.primaryContactEmail,
  })
    .from(invoices)
    .leftJoin(productionCompanies, eq(invoices.productionCompanyId, productionCompanies.id))
    .where(eq(invoices.id, id))
    .get()

  if (!invoice) notFound()

  const linkedProjects = await db.select({
    id: projects.id,
    name: projects.name,
    clientName: clients.name,
  })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.invoiceId, id))
    .all()

  // Get deliverables and shoot for each linked project
  const projectDetails: Record<string, { deliverables: any[]; shoot: any | null }> = {}
  for (const p of linkedProjects) {
    const deliv = db.select().from(deliverables).where(eq(deliverables.projectId, p.id)).all()
    const shoot = db.select().from(shootDetails).where(eq(shootDetails.projectId, p.id)).get()
    projectDetails[p.id] = { deliverables: deliv, shoot: shoot ?? null }
  }

  // Available projects that can be added to this invoice (finished, same company, not on any invoice)
  const availableProjects = db.select({
    id: projects.id,
    name: projects.name,
    clientName: clients.name,
  })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.productionCompanyId, invoice.productionCompanyId!))
    .all()
    .filter(p => p.id && !linkedProjects.find(lp => lp.id === p.id))
    // Only truly unlinked finished projects
    .filter(p => {
      const proj = db.select({ status: projects.status, invoiceId: projects.invoiceId })
        .from(projects).where(eq(projects.id, p.id!)).get()
      return proj?.status === 'finished' && !proj.invoiceId
    })

  // Compute default costs for available projects
  const availableProjectCosts: Record<string, number> = {}
  for (const p of availableProjects) {
    const deliv = db.select({ cost: deliverables.calculatedCost }).from(deliverables).where(eq(deliverables.projectId, p.id!)).all()
    const shoot = db.select({ cost: shootDetails.calculatedShootCost }).from(shootDetails).where(eq(shootDetails.projectId, p.id!)).get()
    availableProjectCosts[p.id!] = deliv.reduce((s, d) => s + d.cost, 0) + (shoot?.cost ?? 0)
  }

  const settings = db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={invoice.invoiceNumber}
        actions={
          <Link href="/invoices">
            <Button variant="outline"><ChevronLeft size={16} /> All Invoices</Button>
          </Link>
        }
      />
      <InvoiceDetailClient
        invoice={invoice}
        linkedProjects={linkedProjects}
        projectDetails={projectDetails}
        settings={settings}
        availableProjects={availableProjects}
        availableProjectCosts={availableProjectCosts}
      />
    </div>
  )
}

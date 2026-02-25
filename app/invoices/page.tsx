import { db } from '@/lib/db'
import { invoices, productionCompanies, projects } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { InvoicesClient } from './invoices-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function InvoicesPage() {
  const allInvoices = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    status: invoices.status,
    invoiceDate: invoices.invoiceDate,
    dueDate: invoices.dueDate,
    total: invoices.total,
    subtotal: invoices.subtotal,
    vatAmount: invoices.vatAmount,
    paymentDate: invoices.paymentDate,
    paymentMethod: invoices.paymentMethod,
    poReference: invoices.poReference,
    productionCompanyId: invoices.productionCompanyId,
    companyName: productionCompanies.name,
  })
    .from(invoices)
    .leftJoin(productionCompanies, eq(invoices.productionCompanyId, productionCompanies.id))
    .orderBy(desc(invoices.createdAt))
    .all()

  const finishedProjects = await db.select({
    id: projects.id,
    name: projects.name,
    productionCompanyId: projects.productionCompanyId,
    companyName: productionCompanies.name,
  })
    .from(projects)
    .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
    .where(eq(projects.status, 'finished'))
    .all()

  const allCompanies = await db.select().from(productionCompanies).where(eq(productionCompanies.isActive, true)).all()

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Invoices"
        actions={
          <Link href="/invoices/new">
            <Button><Plus size={16} /> New Invoice</Button>
          </Link>
        }
      />
      <InvoicesClient invoices={allInvoices} finishedProjects={finishedProjects} companies={allCompanies} />
    </div>
  )
}

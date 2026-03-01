import { db } from '@/lib/db'
import { projects, deliverables, pricingConfig, businessSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { DeliverablesClient } from './deliverables-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export default async function DeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
    includedRevisionRounds: projects.includedRevisionRounds,
  }).from(projects).where(eq(projects.id, id)).get()

  if (!project) notFound()

  const projectDeliverables = await db.select().from(deliverables).where(eq(deliverables.projectId, id)).orderBy(deliverables.createdAt).all()
  const pricing = await db.select().from(pricingConfig).all()
  const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
  const pricingMap = Object.fromEntries(pricing.map(p => [p.configKey, p.configValue]))

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`${project.name} — Deliverables`}
        actions={
          <Link href={`/projects/${id}`}>
            <Button variant="outline"><ChevronLeft size={16} /> Back to Project</Button>
          </Link>
        }
      />
      <DeliverablesClient
        projectId={id}
        projectStatus={project.status}
        deliverables={projectDeliverables}
        pricingMap={pricingMap}
        settings={settings ?? null}
      />
    </div>
  )
}

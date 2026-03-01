import { db } from '@/lib/db'
import { projects, shootDetails, pricingConfig, businessSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { ShootsClient } from './shoots-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export default async function ShootsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
  }).from(projects).where(eq(projects.id, id)).get()

  if (!project) notFound()

  const allShoots = await db.select().from(shootDetails).where(eq(shootDetails.projectId, id)).orderBy(shootDetails.createdAt).all()
  const pricing = await db.select().from(pricingConfig).all()
  const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
  const pricingMap = Object.fromEntries(pricing.map(p => [p.configKey, p.configValue]))

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`${project.name} — Shoot Details`}
        actions={
          <Link href={`/projects/${id}`}>
            <Button variant="outline"><ChevronLeft size={16} /> Back to Project</Button>
          </Link>
        }
      />
      <ShootsClient
        projectId={id}
        projectStatus={project.status}
        shoots={allShoots}
        pricingMap={pricingMap}
        settings={settings ?? null}
      />
    </div>
  )
}

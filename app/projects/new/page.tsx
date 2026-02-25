import { db } from '@/lib/db'
import { productionCompanies, clients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { NewProjectForm } from './new-project-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export default async function NewProjectPage() {
  const companies = await db.select().from(productionCompanies)
    .where(eq(productionCompanies.isActive, true))
    .orderBy(productionCompanies.name).all()
  const allClients = await db.select().from(clients).orderBy(clients.name).all()

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="New Project"
        actions={
          <Link href="/projects">
            <Button variant="outline"><ChevronLeft size={16} /> Back</Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <NewProjectForm companies={companies} clients={allClients} />
        </div>
      </div>
    </div>
  )
}

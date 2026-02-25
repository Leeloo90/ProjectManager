import { db } from '@/lib/db'
import { productionCompanies, clients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { ContactsClient } from './contacts-client'

export default async function ContactsPage() {
  const companies = await db.select().from(productionCompanies).orderBy(productionCompanies.name).all()
  const allClients = await db.select().from(clients).orderBy(clients.name).all()

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Contacts" />
      <ContactsClient companies={companies} clients={allClients} />
    </div>
  )
}

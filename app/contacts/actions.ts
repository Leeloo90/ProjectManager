'use server'
import { db } from '@/lib/db'
import { productionCompanies, clients, activityLog } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

// ─── Production Companies ─────────────────────────────────────────────────────

export async function createProductionCompany(formData: FormData) {
  const id = generateId()
  await db.insert(productionCompanies).values({
    id,
    name: formData.get('name') as string,
    billingAddress: formData.get('billingAddress') as string || null,
    vatNumber: formData.get('vatNumber') as string || null,
    primaryContactName: formData.get('primaryContactName') as string,
    primaryContactEmail: formData.get('primaryContactEmail') as string,
    primaryContactPhone: formData.get('primaryContactPhone') as string || null,
    secondaryContactName: formData.get('secondaryContactName') as string || null,
    secondaryContactEmail: formData.get('secondaryContactEmail') as string || null,
    notes: formData.get('notes') as string || null,
    isActive: true,
  })
  await db.insert(activityLog).values({
    id: generateId(),
    eventType: 'company_created',
    description: `Production company "${formData.get('name')}" created`,
  })
  revalidatePath('/contacts')
}

export async function updateProductionCompany(id: string, formData: FormData) {
  await db.update(productionCompanies)
    .set({
      name: formData.get('name') as string,
      billingAddress: formData.get('billingAddress') as string || null,
      vatNumber: formData.get('vatNumber') as string || null,
      primaryContactName: formData.get('primaryContactName') as string,
      primaryContactEmail: formData.get('primaryContactEmail') as string,
      primaryContactPhone: formData.get('primaryContactPhone') as string || null,
      secondaryContactName: formData.get('secondaryContactName') as string || null,
      secondaryContactEmail: formData.get('secondaryContactEmail') as string || null,
      notes: formData.get('notes') as string || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(productionCompanies.id, id))
  revalidatePath('/contacts')
}

export async function toggleCompanyActive(id: string, isActive: boolean) {
  await db.update(productionCompanies)
    .set({ isActive, updatedAt: new Date().toISOString() })
    .where(eq(productionCompanies.id, id))
  revalidatePath('/contacts')
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function createClient(formData: FormData) {
  const id = generateId()
  const name = formData.get('name') as string
  const productionCompanyId = formData.get('productionCompanyId') as string
  await db.insert(clients).values({
    id,
    name,
    productionCompanyId,
    contactPerson: formData.get('contactPerson') as string || null,
    contactEmail: formData.get('contactEmail') as string || null,
    contactPhone: formData.get('contactPhone') as string || null,
    notes: formData.get('notes') as string || null,
  })
  await db.insert(activityLog).values({
    id: generateId(),
    eventType: 'client_created',
    description: `Client "${name}" created`,
  })
  revalidatePath('/contacts')
  revalidatePath('/projects/new')
  return { id, name, productionCompanyId }
}

export async function updateClient(id: string, formData: FormData) {
  await db.update(clients)
    .set({
      name: formData.get('name') as string,
      productionCompanyId: formData.get('productionCompanyId') as string,
      contactPerson: formData.get('contactPerson') as string || null,
      contactEmail: formData.get('contactEmail') as string || null,
      contactPhone: formData.get('contactPhone') as string || null,
      notes: formData.get('notes') as string || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(clients.id, id))
  revalidatePath('/contacts')
}

export async function deleteClient(id: string) {
  await db.delete(clients).where(eq(clients.id, id))
  revalidatePath('/contacts')
}

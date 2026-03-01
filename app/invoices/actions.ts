'use server'
import { db } from '@/lib/db'
import { invoices, projects, activityLog, businessSettings, deliverables, shootDetails } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateId, generateInvoiceNumber } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

function computeProjectCost(projectId: string): number {
  const deliv = db.select({ cost: deliverables.calculatedCost }).from(deliverables).where(eq(deliverables.projectId, projectId)).all()
  const shoots = db.select({ cost: shootDetails.calculatedShootCost }).from(shootDetails).where(eq(shootDetails.projectId, projectId)).all()
  return deliv.reduce((s, d) => s + d.cost, 0) + shoots.reduce((s, sh) => s + sh.cost, 0)
}

function computeTotals(rawSubtotal: number, discountType: string, discountValue: number) {
  const settings = db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
  const vatRate = settings?.vatRate ?? 15
  const includeVat = settings?.includeVat ?? true
  const discountAmount = discountType === 'percentage'
    ? Math.round(rawSubtotal * discountValue / 100 * 100) / 100
    : discountType === 'fixed' ? discountValue : 0
  const discountedSubtotal = rawSubtotal - discountAmount
  const vatAmount = includeVat ? Math.round(discountedSubtotal * vatRate / 100 * 100) / 100 : 0
  return { vatAmount, total: discountedSubtotal + vatAmount }
}

export async function createInvoice(formData: FormData) {
  const settings = db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()

  const existingInvoices = db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices).all()
  const prefix = settings?.invoicePrefix ?? 'AA'
  const year = new Date().getFullYear()
  const startNum = settings?.invoiceStartingNumber ?? 1

  const yearPattern = `${prefix}-${year}-`
  const yearInvoices = existingInvoices.filter(i => i.invoiceNumber.startsWith(yearPattern))
  let nextSeq = startNum
  if (yearInvoices.length > 0) {
    const seqs = yearInvoices.map(i => {
      const parts = i.invoiceNumber.split('-')
      return parseInt(parts[parts.length - 1]) || 0
    })
    nextSeq = Math.max(...seqs) + 1
  }

  const invoiceNumber = generateInvoiceNumber(prefix, year, nextSeq)
  const productionCompanyId = formData.get('productionCompanyId') as string
  const invoiceDate = formData.get('invoiceDate') as string
  const dueDate = formData.get('dueDate') as string
  const poReference = formData.get('poReference') as string || null
  const projectIds = formData.getAll('projectIds') as string[]
  const discountType = (formData.get('discountType') as string) || 'none'
  const discountValue = parseFloat(formData.get('discountValue') as string) || 0

  const lineItemOverrides: Record<string, number> = {}
  let subtotal = 0
  for (const pid of projectIds) {
    const overrideRaw = formData.get(`priceOverride_${pid}`)
    const price = overrideRaw !== null ? parseFloat(overrideRaw as string) : computeProjectCost(pid)
    lineItemOverrides[pid] = isNaN(price as number) ? computeProjectCost(pid) : (price as number)
    subtotal += lineItemOverrides[pid]
  }

  subtotal = Math.round(subtotal * 100) / 100
  const { vatAmount, total } = computeTotals(subtotal, discountType, discountValue)
  const invoiceId = generateId()

  await db.insert(invoices).values({
    id: invoiceId,
    invoiceNumber,
    productionCompanyId,
    invoiceDate,
    dueDate,
    poReference,
    status: 'draft',
    subtotal,
    vatAmount,
    total: Math.round(total * 100) / 100,
    lineItemOverrides: JSON.stringify(lineItemOverrides),
    discountType: discountType as 'none' | 'percentage' | 'fixed',
    discountValue,
  })

  for (const pid of projectIds) {
    await db.update(projects).set({ status: 'invoiced', invoiceId, updatedAt: new Date().toISOString() }).where(eq(projects.id, pid))
  }

  await db.insert(activityLog).values({
    id: generateId(),
    invoiceId,
    eventType: 'invoice_created',
    description: `Invoice ${invoiceNumber} created for ${projectIds.length} project(s)`,
  })

  revalidatePath('/invoices')
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return invoiceId
}

export async function markInvoicePaid(invoiceId: string, formData: FormData) {
  const paymentDate = formData.get('paymentDate') as string
  const paymentMethod = formData.get('paymentMethod') as string
  const paymentReference = formData.get('paymentReference') as string || null

  await db.update(invoices)
    .set({ status: 'paid', paymentDate, paymentMethod, paymentReference, updatedAt: new Date().toISOString() })
    .where(eq(invoices.id, invoiceId))

  await db.update(projects)
    .set({ status: 'paid', updatedAt: new Date().toISOString() })
    .where(eq(projects.invoiceId, invoiceId))

  await db.insert(activityLog).values({
    id: generateId(),
    invoiceId,
    eventType: 'payment_received',
    description: `Payment received for invoice`,
  })

  revalidatePath('/invoices')
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

export async function voidInvoice(invoiceId: string) {
  await db.update(invoices)
    .set({ status: 'voided', updatedAt: new Date().toISOString() })
    .where(eq(invoices.id, invoiceId))

  await db.update(projects)
    .set({ status: 'finished', invoiceId: null, updatedAt: new Date().toISOString() })
    .where(eq(projects.invoiceId, invoiceId))

  revalidatePath('/invoices')
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

export async function updateInvoice(invoiceId: string, formData: FormData) {
  const invoice = db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)).get()
  if (!invoice || invoice.status !== 'draft') throw new Error('Only draft invoices can be edited.')

  const invoiceDate = formData.get('invoiceDate') as string
  const dueDate = formData.get('dueDate') as string
  const poReference = (formData.get('poReference') as string) || null
  const newProjectIds = formData.getAll('projectIds') as string[]

  const currentLinked = db.select({ id: projects.id }).from(projects).where(eq(projects.invoiceId, invoiceId)).all()
  const currentIds = currentLinked.map(p => p.id)
  const toRemove = currentIds.filter(id => !newProjectIds.includes(id))
  const toAdd = newProjectIds.filter(id => !currentIds.includes(id))

  for (const pid of toRemove) {
    await db.update(projects)
      .set({ status: 'finished', invoiceId: null, updatedAt: new Date().toISOString() })
      .where(eq(projects.id, pid))
  }
  for (const pid of toAdd) {
    await db.update(projects)
      .set({ status: 'invoiced', invoiceId, updatedAt: new Date().toISOString() })
      .where(eq(projects.id, pid))
  }

  const discountType = (formData.get('discountType') as string) || 'none'
  const discountValue = parseFloat(formData.get('discountValue') as string) || 0

  const lineItemOverrides: Record<string, number> = {}
  let subtotal = 0
  for (const pid of newProjectIds) {
    const overrideRaw = formData.get(`priceOverride_${pid}`)
    const price = overrideRaw !== null ? parseFloat(overrideRaw as string) : computeProjectCost(pid)
    lineItemOverrides[pid] = isNaN(price as number) ? computeProjectCost(pid) : (price as number)
    subtotal += lineItemOverrides[pid]
  }

  subtotal = Math.round(subtotal * 100) / 100
  const { vatAmount, total } = computeTotals(subtotal, discountType, discountValue)

  await db.update(invoices).set({
    invoiceDate,
    dueDate,
    poReference,
    lineItemOverrides: JSON.stringify(lineItemOverrides),
    discountType: discountType as 'none' | 'percentage' | 'fixed',
    discountValue,
    subtotal,
    vatAmount,
    total: Math.round(total * 100) / 100,
    updatedAt: new Date().toISOString(),
  }).where(eq(invoices.id, invoiceId))

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  revalidatePath('/projects')
}

export async function markInvoiceSent(invoiceId: string) {
  const invoice = db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)).get()
  if (!invoice || invoice.status !== 'draft') throw new Error('Invoice is not in draft status.')

  await db.update(invoices)
    .set({ status: 'sent', updatedAt: new Date().toISOString() })
    .where(eq(invoices.id, invoiceId))

  await db.insert(activityLog).values({
    id: generateId(),
    invoiceId,
    eventType: 'invoice_sent',
    description: 'Invoice marked as sent',
  })

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  revalidatePath('/dashboard')
}

export async function deleteInvoice(invoiceId: string) {
  const invoice = db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)).get()
  if (!invoice || invoice.status !== 'voided') throw new Error('Only voided invoices can be deleted.')

  // Safety: unlink any projects still referencing this invoice
  await db.update(projects)
    .set({ status: 'finished', invoiceId: null, updatedAt: new Date().toISOString() })
    .where(eq(projects.invoiceId, invoiceId))

  // Delete the invoice (activity_log FK is ON DELETE SET NULL — rows are kept, invoiceId nulled)
  await db.delete(invoices).where(eq(invoices.id, invoiceId))

  revalidatePath('/invoices')
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

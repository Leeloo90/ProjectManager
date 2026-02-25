'use server'
import { db } from '@/lib/db'
import { businessSettings, pricingConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function updateBusinessSettings(formData: FormData) {
  await db.update(businessSettings)
    .set({
      businessName: formData.get('businessName') as string,
      businessAddress: formData.get('businessAddress') as string || null,
      vatNumber: formData.get('vatNumber') as string || null,
      businessRegistrationNumber: formData.get('businessRegistrationNumber') as string || null,
      bankingDetails: formData.get('bankingDetails') as string || null,
      invoicePrefix: formData.get('invoicePrefix') as string || 'AA',
      invoiceStartingNumber: parseInt(formData.get('invoiceStartingNumber') as string) || 1,
      vatRate: parseFloat(formData.get('vatRate') as string) || 15,
      includeVat: formData.get('includeVat') === 'true',
      baseLocation: formData.get('baseLocation') as string || null,
      overnightDistanceThreshold: parseFloat(formData.get('overnightDistanceThreshold') as string) || 200,
      perKmTravelRate: parseFloat(formData.get('perKmTravelRate') as string) || 5,
      defaultRevisionRounds: parseInt(formData.get('defaultRevisionRounds') as string) || 2,
      paymentTermsText: formData.get('paymentTermsText') as string || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(businessSettings.id, 'singleton'))
  revalidatePath('/settings')
}

export async function updatePricingValue(key: string, value: number) {
  await db.update(pricingConfig)
    .set({ configValue: value, updatedAt: new Date().toISOString() })
    .where(eq(pricingConfig.configKey, key))
  revalidatePath('/settings')
}

export async function updateAllPricing(updates: Record<string, number>) {
  for (const [key, value] of Object.entries(updates)) {
    await db.update(pricingConfig)
      .set({ configValue: value, updatedAt: new Date().toISOString() })
      .where(eq(pricingConfig.configKey, key))
  }
  revalidatePath('/settings')
}

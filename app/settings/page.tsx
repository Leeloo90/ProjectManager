import { db } from '@/lib/db'
import { businessSettings, pricingConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
  const pricing = await db.select().from(pricingConfig).orderBy(pricingConfig.category, pricingConfig.configKey).all()

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Settings & Pricing" />
      <SettingsClient settings={settings} pricing={pricing} />
    </div>
  )
}

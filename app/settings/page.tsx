import { db } from '@/lib/db'
import { businessSettings, pricingConfig, googleAuth } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { SettingsClient } from './settings-client'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ gmail?: string; frameio?: string; google?: string }> }) {
  const [settings, pricing, authRow, sp] = await Promise.all([
    db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get(),
    db.select().from(pricingConfig).orderBy(pricingConfig.category, pricingConfig.configKey).all(),
    db.select({ refreshToken: googleAuth.refreshToken }).from(googleAuth).where(eq(googleAuth.id, 'singleton')).get(),
    searchParams,
  ])
  const googleStatus = sp.google ?? sp.gmail ?? null
  const frameioStatus = sp.frameio ?? null

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Settings & Pricing" />
      <SettingsClient
        settings={settings}
        pricing={pricing}
        isGoogleConnected={!!authRow?.refreshToken}
        googleStatus={googleStatus}
        isFrameioConnected={!!process.env.FRAMEIO_ACCESS_TOKEN}
        frameioStatus={frameioStatus}
      />
    </div>
  )
}

import { db } from '@/lib/db'
import { businessSettings, pricingConfig, integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { SettingsClient } from './settings-client'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ gmail?: string; tab?: string; connected?: string }> }) {
  const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
  const pricing = await db.select().from(pricingConfig).orderBy(pricingConfig.category, pricingConfig.configKey).all()
  const frameioIntegration = await db.select().from(integrations).where(eq(integrations.service, 'frameio')).get()
  const sp = await searchParams
  const gmailStatus = sp.gmail ?? null
  const activeTab = sp.tab ?? null
  const frameioConnected = sp.connected === 'true'

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Settings & Pricing" />
      <SettingsClient
        settings={settings}
        pricing={pricing}
        isGmailConnected={!!settings?.gmailRefreshToken}
        gmailStatus={gmailStatus}
        frameioIntegration={frameioIntegration ?? null}
        initialTab={activeTab === 'integrations' ? 'integrations' : null}
        frameioConnected={frameioConnected}
      />
    </div>
  )
}

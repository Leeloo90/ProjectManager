import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export function getFrameIoIntegration() {
  return db.select().from(integrations).where(eq(integrations.service, 'frameio')).get() ?? null
}

export async function getFrameIoToken(): Promise<string | null> {
  const row = getFrameIoIntegration()
  if (!row || !row.isActive) return null

  // Check if token is expiring within the next 5 minutes
  if (row.tokenExpiresAt) {
    const expiresAt = new Date(row.tokenExpiresAt).getTime()
    const fiveMinutes = 5 * 60 * 1000
    if (Date.now() + fiveMinutes >= expiresAt && row.refreshToken) {
      try {
        const params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: row.refreshToken,
          client_id: process.env.FRAMEIO_CLIENT_ID!,
          client_secret: process.env.FRAMEIO_CLIENT_SECRET!,
        })
        const res = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })
        if (!res.ok) {
          console.error('[frameio/get-token] Token refresh failed:', await res.text())
          return null
        }
        const data = await res.json()
        const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
        await db
          .update(integrations)
          .set({ accessToken: data.access_token, tokenExpiresAt: newExpiresAt })
          .where(eq(integrations.service, 'frameio'))
        return data.access_token as string
      } catch (err) {
        console.error('[frameio/get-token] Token refresh error:', err)
        return null
      }
    }
  }

  return row.accessToken
}

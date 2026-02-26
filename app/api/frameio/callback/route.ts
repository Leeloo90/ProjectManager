import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const SETTINGS_INTEGRATIONS = '/settings?tab=integrations'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`${SETTINGS_INTEGRATIONS}&error=auth_failed`, request.url))
  }

  // Verify state to prevent CSRF
  const cookieStore = await cookies()
  const storedState = cookieStore.get('frameio_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL(`${SETTINGS_INTEGRATIONS}&error=state_mismatch`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${SETTINGS_INTEGRATIONS}&error=auth_failed`, request.url))
  }

  try {
    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.FRAMEIO_CLIENT_ID!,
      client_secret: process.env.FRAMEIO_CLIENT_SECRET!,
      redirect_uri: process.env.FRAMEIO_REDIRECT_URI!,
    })

    const tokenRes = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })

    if (!tokenRes.ok) {
      console.error('[frameio/callback] Token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(new URL(`${SETTINGS_INTEGRATIONS}&error=auth_failed`, request.url))
    }

    const tokens = await tokenRes.json()
    const { access_token, refresh_token, expires_in } = tokens
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Fetch account info
    let accountId = ''
    let accountName = ''
    try {
      const meRes = await fetch('https://api.frame.io/v4/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      if (meRes.ok) {
        const me = await meRes.json()
        console.log('[frameio/callback] /v4/me response:', JSON.stringify(me))
        // account_id is the Frame.io account (not user id)
        accountId = me.account_id ?? me.root_asset_id ?? ''
        accountName = me.name ?? me.email ?? me.display_name ?? ''
      } else {
        console.error('[frameio/callback] /v4/me failed:', await meRes.text())
      }

      // If still no account ID, try /v4/accounts
      if (!accountId) {
        const accountsRes = await fetch('https://api.frame.io/v4/accounts', {
          headers: { Authorization: `Bearer ${access_token}` },
        })
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json()
          console.log('[frameio/callback] /v4/accounts response:', JSON.stringify(accountsData))
          const accounts: any[] = accountsData.data ?? accountsData ?? []
          if (accounts.length > 0) {
            accountId = accounts[0].id ?? ''
            accountName = accountName || (accounts[0].name ?? '')
          }
        } else {
          console.error('[frameio/callback] /v4/accounts failed:', await accountsRes.text())
        }
      }
    } catch (err) {
      console.error('[frameio/callback] Failed to fetch account info:', err)
    }

    console.log('[frameio/callback] Final accountId:', accountId, '| accountName:', accountName)

    // Upsert integrations row
    const existing = db
      .select({ id: integrations.id })
      .from(integrations)
      .where(eq(integrations.service, 'frameio'))
      .get()

    if (existing) {
      await db
        .update(integrations)
        .set({
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiresAt,
          accountId,
          accountName,
          isActive: true,
          connectedAt: new Date().toISOString(),
        })
        .where(eq(integrations.service, 'frameio'))
    } else {
      await db.insert(integrations).values({
        service: 'frameio',
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
        accountId,
        accountName,
        isActive: true,
        connectedAt: new Date().toISOString(),
      })
    }

    // Clear the state cookie
    cookieStore.delete('frameio_oauth_state')

    return NextResponse.redirect(new URL(`${SETTINGS_INTEGRATIONS}&connected=true`, request.url))
  } catch (err) {
    console.error('[frameio/callback] Error:', err)
    return NextResponse.redirect(new URL(`${SETTINGS_INTEGRATIONS}&error=auth_failed`, request.url))
  }
}

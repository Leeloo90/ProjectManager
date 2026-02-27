import { NextRequest, NextResponse } from 'next/server'
import { updateEnvFile } from '@/lib/frameio/auth'

const TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?frameio=error&reason=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?frameio=error&reason=no_code', request.url))
  }

  const clientId = process.env.FRAMEIO_CLIENT_ID
  const clientSecret = process.env.FRAMEIO_CLIENT_SECRET
  const redirectUri = process.env.FRAMEIO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL('/settings?frameio=error&reason=missing_credentials', request.url))
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error('[frameio/callback] Token exchange failed:', tokenRes.status, text)
      return NextResponse.redirect(new URL('/settings?frameio=error&reason=token_exchange_failed', request.url))
    }

    const tokenData = await tokenRes.json()
    const accessToken: string = tokenData.access_token
    const refreshToken: string = tokenData.refresh_token ?? ''

    if (!accessToken) {
      return NextResponse.redirect(new URL('/settings?frameio=error&reason=no_access_token', request.url))
    }

    // Fetch account ID
    const accountsRes = await fetch('https://api.frame.io/v4/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!accountsRes.ok) {
      console.error('[frameio/callback] Failed to fetch accounts:', accountsRes.status)
      return NextResponse.redirect(new URL('/settings?frameio=error&reason=accounts_fetch_failed', request.url))
    }

    const accountsData = await accountsRes.json()
    const accounts = accountsData.data ?? accountsData
    const accountId: string = Array.isArray(accounts) ? accounts[0]?.id : accounts?.id

    if (!accountId) {
      return NextResponse.redirect(new URL('/settings?frameio=error&reason=no_account_id', request.url))
    }

    // Persist tokens to .env.local
    updateEnvFile({
      FRAMEIO_ACCESS_TOKEN: accessToken,
      FRAMEIO_REFRESH_TOKEN: refreshToken,
      FRAMEIO_ACCOUNT_ID: accountId,
    })

    return NextResponse.redirect(new URL('/settings?frameio=connected', request.url))
  } catch (err) {
    console.error('[frameio/callback] Error:', err)
    return NextResponse.redirect(new URL('/settings?frameio=error&reason=unexpected_error', request.url))
  }
}

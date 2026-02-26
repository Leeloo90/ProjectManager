import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const clientId = process.env.FRAMEIO_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'FRAMEIO_CLIENT_ID is not set in .env.local' },
      { status: 500 }
    )
  }

  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set('frameio_oauth_state', state, {
    httpOnly: true,
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: process.env.FRAMEIO_REDIRECT_URI!,
    scope: 'offline_access, profile, email, additional_info.roles, openid',
    response_type: 'code',
    state,
  })

  const authUrl = `https://ims-na1.adobelogin.com/ims/authorize/v2?${params.toString()}`

  return NextResponse.redirect(authUrl)
}

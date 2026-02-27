import { NextResponse } from 'next/server'

const AUTHORIZE_URL = 'https://ims-na1.adobelogin.com/ims/authorize/v2'

export async function GET() {
  const clientId = process.env.FRAMEIO_CLIENT_ID
  const redirectUri = process.env.FRAMEIO_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'FRAMEIO_CLIENT_ID and FRAMEIO_REDIRECT_URI must be set in .env.local' },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid,profile,email,offline_access,additional_info.roles',
    response_type: 'code',
  })

  return NextResponse.redirect(`${AUTHORIZE_URL}?${params.toString()}`)
}

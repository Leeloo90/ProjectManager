import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env.local' },
      { status: 500 }
    )
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3000/api/gmail/callback'
  )

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force consent so we always get a refresh_token
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  })

  return NextResponse.redirect(authUrl)
}

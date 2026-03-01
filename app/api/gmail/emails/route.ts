import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { db } from '@/lib/db'
import { googleAuth } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function getOAuth2Client(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractBody(payload: any): { html: string | null; plain: string | null } {
  let html: string | null = null
  let plain: string | null = null

  function walk(part: any) {
    if (!part) return
    const mimeType: string = part.mimeType ?? ''
    const body = part.body

    if (mimeType === 'text/html' && body?.data) {
      html = decodeBase64(body.data)
    } else if (mimeType === 'text/plain' && body?.data) {
      plain = decodeBase64(body.data)
    }

    if (part.parts) {
      for (const subPart of part.parts) walk(subPart)
    }
  }

  walk(payload)
  return { html, plain }
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const labelName = searchParams.get('label')
  const full = searchParams.get('full') // ?full=<messageId> to fetch a single full email body

  if (!labelName) {
    return NextResponse.json({ error: 'label query param required' }, { status: 400 })
  }

  const authRow = db
    .select({ refreshToken: googleAuth.refreshToken })
    .from(googleAuth)
    .where(eq(googleAuth.id, 'singleton'))
    .get()

  if (!authRow?.refreshToken) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 401 })
  }

  try {
    const auth = getOAuth2Client(authRow.refreshToken)
    const gmail = google.gmail({ version: 'v1', auth })

    // If fetching full body for a single message
    if (full) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: full,
        format: 'full',
      })
      const { html, plain } = extractBody(msg.data.payload)
      return NextResponse.json({ html, plain })
    }

    // List labels to find matching label ID (case-insensitive)
    const labelsRes = await gmail.users.labels.list({ userId: 'me' })
    const labels = labelsRes.data.labels ?? []
    const match = labels.find(
      l => l.name?.toLowerCase() === labelName.toLowerCase()
    )

    if (!match?.id) {
      return NextResponse.json({ emails: [], labelNotFound: true })
    }

    // List messages with this label
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [match.id],
      maxResults: 50,
    })

    const messages = listRes.data.messages ?? []
    if (messages.length === 0) {
      return NextResponse.json({ emails: [] })
    }

    // Fetch metadata for each message
    const emails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date', 'To'],
        })
        const headers = detail.data.payload?.headers ?? []
        return {
          id: msg.id!,
          subject: getHeader(headers, 'Subject') || '(no subject)',
          from: getHeader(headers, 'From'),
          to: getHeader(headers, 'To'),
          date: getHeader(headers, 'Date'),
          snippet: detail.data.snippet ?? '',
        }
      })
    )

    return NextResponse.json({ emails })
  } catch (err: any) {
    console.error('[gmail/emails] Error:', err?.message ?? err)
    return NextResponse.json(
      { error: 'Failed to fetch emails', details: err?.message },
      { status: 500 }
    )
  }
}

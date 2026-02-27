import { NextRequest, NextResponse } from 'next/server'
import { getFrameioToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

export async function POST(request: NextRequest) {
  try {
    const { commentId, text, accountId: bodyAccountId } = await request.json()

    if (!commentId || !text) {
      return NextResponse.json({ error: 'commentId and text are required' }, { status: 400 })
    }

    const token = await getFrameioToken()
    const accountId = bodyAccountId ?? process.env.FRAMEIO_ACCOUNT_ID

    if (!accountId) {
      return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })
    }

    const res = await fetch(`${BASE}/accounts/${accountId}/comments/${commentId}/replies`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { text } }),
    })

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: `Failed to post reply: ${body}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data.data ?? data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

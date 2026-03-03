import { NextRequest, NextResponse } from 'next/server'
import { getFrameioToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

export async function POST(request: NextRequest) {
  const { assetId, name } = await request.json()

  if (!assetId) {
    return NextResponse.json({ error: 'assetId required' }, { status: 400 })
  }

  const accountId = process.env.FRAMEIO_ACCOUNT_ID
  if (!accountId) {
    return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })
  }

  try {
    const token = await getFrameioToken()

    const res = await fetch(`${BASE}/accounts/${accountId}/review_links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name ?? 'Review',
        file_ids: [assetId],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Frame.io returned ${res.status}: ${text}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    const link = data.data ?? data
    // Frame.io may return short_url, link, or url depending on version
    const url: string | null =
      link.short_url ?? link.link ?? link.url ?? link.share_url ?? null

    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

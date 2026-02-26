import { NextRequest, NextResponse } from 'next/server'
import { getFrameIoToken } from '@/lib/frameio/get-token'
import { convertFrameToTimecode } from '@/lib/frameio/sync-comments'

const FRAMEIO_V4 = 'https://api.frame.io/v4'

export async function GET(request: NextRequest) {
  const token = await getFrameIoToken()
  if (!token) return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const assetId = searchParams.get('assetId')
  const fps = parseFloat(searchParams.get('fps') ?? '25')

  if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })

  try {
    const res = await fetch(`${FRAMEIO_V4}/assets/${assetId}/comments`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      console.error('[frameio/comments] V4 failed:', res.status, await res.text())
      return NextResponse.json({ comments: [] })
    }

    const data = await res.json()
    const raw: any[] = data?.data ?? (Array.isArray(data) ? data : [])

    const comments = raw.map((c: any) => ({
      id: c.id,
      text: c.text ?? '',
      commenterName: c.owner?.name ?? c.owner?.email ?? 'Unknown',
      timecode: c.timestamp != null ? convertFrameToTimecode(c.timestamp, fps) : null,
      insertedAt: c.inserted_at ?? null,
    }))

    return NextResponse.json({ comments })
  } catch (err) {
    console.error('[frameio/comments] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

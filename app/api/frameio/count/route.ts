import { NextRequest, NextResponse } from 'next/server'
import { getFrameioToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

async function countFilesInFolder(accountId: string, folderId: string, token: string): Promise<number> {
  let count = 0
  let cursor: string | null =
    `${BASE}/accounts/${accountId}/folders/${folderId}/children?page_size=100`

  while (cursor !== null) {
    const url = cursor
    cursor = null
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) break

    const data: { data?: { id: string; type: string }[]; links?: { next?: string } } = await res.json()
    const items = data.data ?? []

    for (const item of items) {
      if (item.type === 'file') {
        count++
      } else if (item.type === 'folder' || item.type === 'version_stack') {
        // Recurse into sub-folders
        count += await countFilesInFolder(accountId, item.id, token)
      }
    }

    const nextPath = data.links?.next
    if (nextPath) cursor = nextPath.startsWith('http') ? nextPath : `${BASE}${nextPath}`
  }

  return count
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')
  const accountId = searchParams.get('accountId') ?? process.env.FRAMEIO_ACCOUNT_ID

  if (!folderId) {
    return NextResponse.json({ error: 'folderId is required' }, { status: 400 })
  }
  if (!accountId) {
    return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })
  }

  try {
    const token = await getFrameioToken()
    const count = await countFilesInFolder(accountId, folderId, token)
    return NextResponse.json({ count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not connected') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

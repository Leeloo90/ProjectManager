import { NextRequest, NextResponse } from 'next/server'
import { getFrameioToken, refreshAccessToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

type RawItem = {
  id: string
  name: string
  type?: string
  _type?: string
  thumb_url?: string
  cover_image_url?: string
  media_links?: { thumbnail?: { download_url?: string } }
  duration?: number
  comment_count?: number
  media_type?: string
}

function shapeItems(rawItems: RawItem[]) {
  return rawItems.map(item => ({
    id: item.id,
    name: item.name,
    type: (item.type ?? item._type ?? 'file') as 'file' | 'folder' | 'version_stack',
    thumb_url: item.media_links?.thumbnail?.download_url ?? item.cover_image_url ?? item.thumb_url ?? null,
    duration: item.duration ?? null,
    comment_count: item.comment_count ?? 0,
    media_type: item.media_type ?? null,
  }))
}

async function fetchAllFolderItems(
  accountId: string,
  folderId: string,
  token: string,
): Promise<{ ok: true; items: RawItem[] } | { ok: false; status: number }> {
  const allItems: RawItem[] = []
  let cursor: string | null = `${BASE}/accounts/${accountId}/folders/${folderId}/children?include=media_links.thumbnail`

  while (cursor !== null) {
    const url: string = cursor
    cursor = null
    const pageRes: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

    if (!pageRes.ok) return { ok: false, status: pageRes.status }

    const pageData: { data?: RawItem[]; links?: { next?: string } } = await pageRes.json()
    const items: RawItem[] = pageData.data ?? (pageData as unknown as RawItem[])
    allItems.push(...items)

    const nextPath: string | undefined = pageData.links?.next
    if (nextPath) cursor = nextPath.startsWith('http') ? nextPath : `${BASE}${nextPath}`
  }

  return { ok: true, items: allItems }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')
  const accountIdParam = searchParams.get('accountId')

  if (!folderId) {
    return NextResponse.json({ error: 'folderId is required' }, { status: 400 })
  }

  try {
    let token = await getFrameioToken()
    const primaryAccountId = accountIdParam ?? process.env.FRAMEIO_ACCOUNT_ID

    if (!primaryAccountId) {
      return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })
    }

    let result = await fetchAllFolderItems(primaryAccountId, folderId, token)

    // If Frame.io returned 401, the token may have slipped through without refreshing —
    // force a refresh and retry once before giving up
    if (!result.ok && result.status === 401) {
      try {
        token = await refreshAccessToken()
        result = await fetchAllFolderItems(primaryAccountId, folderId, token)
      } catch { /* fall through to error response below */ }
    }

    if (result.ok) {
      return NextResponse.json({ items: shapeItems(result.items), resolvedAccountId: primaryAccountId })
    }

    // On 404, the folder belongs to a different account — try all accounts
    if (result.status === 404) {
      const accountsRes: Response = await fetch(`${BASE}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (accountsRes.ok) {
        const accountsData: { data?: { id: string }[] } = await accountsRes.json()
        const accounts: { id: string }[] = accountsData.data ?? []

        for (const account of accounts) {
          if (account.id === primaryAccountId) continue
          const retry = await fetchAllFolderItems(account.id, folderId, token)
          if (retry.ok) {
            return NextResponse.json({ items: shapeItems(retry.items), resolvedAccountId: account.id })
          }
        }
      }
      return NextResponse.json({ error: 'Folder not found on any account' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to fetch folder contents' }, { status: result.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not connected') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

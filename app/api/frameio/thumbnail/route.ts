import { NextRequest, NextResponse } from 'next/server'
import { getFrameioToken, refreshAccessToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

async function fetchThumbnailUrl(accountId: string, assetId: string, token: string): Promise<string | null> {
  const res = await fetch(
    `${BASE}/accounts/${accountId}/files/${assetId}?include=media_links.thumbnail`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return null
  const data = await res.json()
  const file = data.data ?? {}
  return file.media_links?.thumbnail?.download_url ?? file.cover_image_url ?? file.thumb_url ?? null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const assetId = searchParams.get('assetId')

  if (!assetId) {
    return new NextResponse(null, { status: 400 })
  }

  try {
    let token = await getFrameioToken()
    const primaryAccountId = process.env.FRAMEIO_ACCOUNT_ID
    if (!primaryAccountId) {
      return new NextResponse(null, { status: 401 })
    }

    let thumbUrl = await fetchThumbnailUrl(primaryAccountId, assetId, token)

    // 401 — refresh token and retry
    if (thumbUrl === null) {
      try {
        token = await refreshAccessToken()
        thumbUrl = await fetchThumbnailUrl(primaryAccountId, assetId, token)
      } catch { /* ignore */ }
    }

    // File on a different account — try all accounts
    if (thumbUrl === null) {
      const accountsRes = await fetch(`${BASE}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json()
        const accounts: { id: string }[] = accountsData.data ?? []
        for (const account of accounts) {
          if (account.id === primaryAccountId) continue
          const alt = await fetchThumbnailUrl(account.id, assetId, token)
          if (alt) { thumbUrl = alt; break }
        }
      }
    }

    if (!thumbUrl) {
      return new NextResponse(null, { status: 404 })
    }

    // Fetch the actual image and proxy it back
    const imgRes = await fetch(thumbUrl)
    if (!imgRes.ok) {
      return new NextResponse(null, { status: 502 })
    }

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await imgRes.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        // Cache for 1 hour in the browser, re-validate via server after 30 min
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
      },
    })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}

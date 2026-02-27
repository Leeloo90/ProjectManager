import { NextRequest, NextResponse } from 'next/server'
import { getFrameioToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

async function tryFetchFile(accountId: string, fileId: string, token: string): Promise<Response> {
  return fetch(`${BASE}/accounts/${accountId}/files/${fileId}?include=media_links.original`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')
  const accountIdParam = searchParams.get('accountId')

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
  }

  try {
    const token = await getFrameioToken()
    const primaryAccountId = accountIdParam ?? process.env.FRAMEIO_ACCOUNT_ID

    if (!primaryAccountId) {
      return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })
    }

    let res = await tryFetchFile(primaryAccountId, fileId, token)
    let resolvedAccountId = primaryAccountId

    // On 404, file belongs to a different account — try all accounts
    if (res.status === 404) {
      const accountsRes: Response = await fetch(`${BASE}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (accountsRes.ok) {
        const accountsData: { data?: { id: string }[] } = await accountsRes.json()
        const accounts: { id: string }[] = accountsData.data ?? []

        for (const account of accounts) {
          if (account.id === primaryAccountId) continue
          const retry = await tryFetchFile(account.id, fileId, token)
          if (retry.ok) {
            res = retry
            resolvedAccountId = account.id
            break
          }
        }
      }
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: res.status })
    }

    const data = await res.json()
    const file = data.data

    const playbackUrl =
      file?.media_links?.original?.inline_url ??
      file?.media_links?.original?.download_url ??
      null

    return NextResponse.json({
      ...file,
      playback_url: playbackUrl,
      resolvedAccountId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not connected') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

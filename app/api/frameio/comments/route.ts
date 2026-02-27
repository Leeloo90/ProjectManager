import { NextRequest, NextResponse } from 'next/server'
import { getFrameioToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

type RawComment = {
  id: string
  text?: string
  message?: string
  timestamp?: string
  owner?: { name?: string; display_name?: string; email?: string; avatar_url?: string; image_url?: string }
  author?: { name?: string; display_name?: string; email?: string; avatar_url?: string; image_url?: string }
  replies?: RawComment[]
  created_at?: string
  inserted_at?: string
}

type ShapedComment = {
  id: string; text: string; timestamp: string | null;
  owner: { name: string; email: string | null; avatar_url: string | null };
  replies: ShapedComment[]; created_at: string | null;
}

function shapeComment(c: RawComment): ShapedComment {
  const person = c.owner ?? c.author ?? {}
  return {
    id: c.id,
    text: c.text ?? c.message ?? '',
    timestamp: c.timestamp ?? null,
    owner: {
      name: person.name ?? person.display_name ?? '',
      email: person.email ?? null,
      avatar_url: person.avatar_url ?? person.image_url ?? null,
    },
    replies: (c.replies ?? []).map(shapeComment),
    created_at: c.created_at ?? c.inserted_at ?? null,
  }
}

async function fetchAllComments(
  accountId: string,
  fileId: string,
  token: string,
): Promise<{ ok: true; comments: RawComment[] } | { ok: false; status: number }> {
  const allComments: RawComment[] = []
  let cursor: string | null = `${BASE}/accounts/${accountId}/files/${fileId}/comments?include=owner,replies`

  while (cursor !== null) {
    const url: string = cursor
    cursor = null
    const pageRes: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

    if (!pageRes.ok) return { ok: false, status: pageRes.status }

    const pageData: { data?: RawComment[]; links?: { next?: string } } = await pageRes.json()
    const items: RawComment[] = pageData.data ?? (pageData as unknown as RawComment[])
    allComments.push(...items)

    const nextPath: string | undefined = pageData.links?.next
    if (nextPath) cursor = nextPath.startsWith('http') ? nextPath : `${BASE}${nextPath}`
  }

  return { ok: true, comments: allComments }
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

    const result = await fetchAllComments(primaryAccountId, fileId, token)

    if (result.ok) {
      return NextResponse.json(result.comments.map(shapeComment))
    }

    // On 404, file belongs to a different account — try all accounts
    if (result.status === 404) {
      const accountsRes: Response = await fetch(`${BASE}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (accountsRes.ok) {
        const accountsData: { data?: { id: string }[] } = await accountsRes.json()
        const accounts: { id: string }[] = accountsData.data ?? []

        for (const account of accounts) {
          if (account.id === primaryAccountId) continue
          const retry = await fetchAllComments(account.id, fileId, token)
          if (retry.ok) {
            return NextResponse.json(retry.comments.map(shapeComment))
          }
        }
      }
      return NextResponse.json({ error: 'File not found on any account' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: result.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not connected') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileId, text, timestamp, accountId: bodyAccountId } = await request.json()

    if (!fileId || !text) {
      return NextResponse.json({ error: 'fileId and text are required' }, { status: 400 })
    }

    const token = await getFrameioToken()
    const accountId = bodyAccountId ?? process.env.FRAMEIO_ACCOUNT_ID

    if (!accountId) {
      return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })
    }

    const body: { data: { text: string; timestamp?: string } } = {
      data: { text },
    }
    if (timestamp) {
      body.data.timestamp = timestamp
    }

    const res = await fetch(`${BASE}/accounts/${accountId}/files/${fileId}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `Failed to post comment: ${errText}` }, { status: res.status })
    }

    const data = await res.json()
    const comment = data.data ?? data
    return NextResponse.json(shapeComment(comment))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

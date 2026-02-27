import { NextResponse } from 'next/server'
import { getFrameioToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

type RawAccount = { id: string; name: string }
type RawWorkspace = { id: string; name: string }
type RawProject = { id: string; name: string; root_folder_id?: string; thumb_url?: string; cover_image_url?: string }

async function fetchAllPages<T>(url: string, token: string): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = url
  while (cursor !== null) {
    const currentUrl: string = cursor
    cursor = null
    const res: Response = await fetch(currentUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) break
    const data: { data?: T[]; links?: { next?: string } } = await res.json()
    const items: T[] = data.data ?? []
    all.push(...items)
    const next: string | undefined = data.links?.next
    if (next) cursor = next.startsWith('http') ? next : `${BASE}${next}`
  }
  return all
}

export async function GET() {
  try {
    const token = await getFrameioToken()

    // Fetch all accounts the token has access to
    const accounts = await fetchAllPages<RawAccount>(`${BASE}/accounts`, token)

    if (accounts.length === 0) {
      return NextResponse.json({ error: 'Frame.io not connected — no accounts found' }, { status: 401 })
    }

    const allProjects: {
      id: string
      name: string
      account_name: string
      workspace_name: string
      root_folder_id: string
      thumb_url: string | null
    }[] = []

    for (const account of accounts) {
      const workspaces = await fetchAllPages<RawWorkspace>(
        `${BASE}/accounts/${account.id}/workspaces`,
        token
      )
      for (const ws of workspaces) {
        const projects = await fetchAllPages<RawProject>(
          `${BASE}/accounts/${account.id}/workspaces/${ws.id}/projects`,
          token
        )
        for (const p of projects) {
          allProjects.push({
            id: p.id,
            name: p.name,
            account_name: account.name,
            workspace_name: ws.name,
            root_folder_id: p.root_folder_id ?? '',
            thumb_url: p.cover_image_url ?? p.thumb_url ?? null,
          })
        }
      }
    }

    return NextResponse.json(allProjects)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not connected') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

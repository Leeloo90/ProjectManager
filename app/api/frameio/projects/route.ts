import { NextResponse } from 'next/server'
import { getFrameIoToken, getFrameIoIntegration } from '@/lib/frameio/get-token'

const FRAMEIO_V4 = 'https://api.frame.io/v4'

async function get(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = await res.text()
  if (!res.ok) {
    console.error(`[frameio/projects] GET ${url} → ${res.status}:`, text.slice(0, 300))
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    console.error(`[frameio/projects] GET ${url} → invalid JSON:`, text.slice(0, 300))
    return null
  }
}

export async function GET() {
  const token = await getFrameIoToken()
  if (!token) {
    return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })
  }

  const integration = getFrameIoIntegration()
  const accountId = integration?.accountId

  if (!accountId) {
    return NextResponse.json({ error: 'Frame.io account not configured' }, { status: 400 })
  }

  try {
    const allProjects: any[] = []

    // V4: accounts → workspaces → projects (confirmed working)
    const wsData = await get(`${FRAMEIO_V4}/accounts/${accountId}/workspaces`, token)
    const workspaces: any[] = wsData?.data ?? []

    for (const ws of workspaces) {
      const projData = await get(`${FRAMEIO_V4}/accounts/${accountId}/workspaces/${ws.id}/projects`, token)
      const projs: any[] = projData?.data ?? []

      for (const p of projs) {
        allProjects.push({
          id: p.id,
          name: p.name,
          updated_at: p.updated_at ?? p.inserted_at ?? null,
          // V4 field is root_folder_id
          root_asset_id: p.root_folder_id ?? p.root_asset_id ?? null,
          account_id: accountId,
          workspace_id: ws.id,
        })
      }

      if (projs.length > 0) {
        console.log(`[frameio/projects] workspace ${ws.id} first project:`, JSON.stringify(projs[0]))
      }
    }

    return NextResponse.json({ projects: allProjects })
  } catch (err) {
    console.error('[frameio/projects] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch Frame.io projects' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getFrameIoToken, getFrameIoIntegration } from '@/lib/frameio/get-token'

const FRAMEIO_V4 = 'https://api.frame.io/v4'

async function get(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = await res.text()
  if (!res.ok) {
    console.error(`[frameio/assets] GET ${url} → ${res.status}:`, text.slice(0, 300))
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const token = await getFrameIoToken()
  if (!token) return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })

  const integration = getFrameIoIntegration()
  const accountId = integration?.accountId
  if (!accountId) return NextResponse.json({ error: 'Frame.io account not configured' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')
  const projectId = searchParams.get('projectId') // fallback only

  if (!folderId && !projectId) {
    return NextResponse.json({ error: 'folderId or projectId required' }, { status: 400 })
  }

  try {
    let data: any = null

    if (folderId) {
      // Explicit V4 path: /accounts/{accountId}/folders/{folderId}/children
      data = await get(`${FRAMEIO_V4}/accounts/${accountId}/folders/${folderId}/children`, token)
      console.log(`[frameio/assets] V4 /folders/${folderId}/children →`, JSON.stringify(data)?.slice(0, 300))
    } else {
      // Fallback: resolve root_folder_id from the project listing, then fetch children
      const wsData = await get(`${FRAMEIO_V4}/accounts/${accountId}/workspaces`, token)
      const workspaces: any[] = wsData?.data ?? []

      for (const ws of workspaces) {
        const projList = await get(`${FRAMEIO_V4}/accounts/${accountId}/workspaces/${ws.id}/projects`, token)
        const projs: any[] = projList?.data ?? []
        const match = projs.find((p: any) => p.id === projectId)
        const rootId = match?.root_folder_id ?? match?.root_asset_id
        if (rootId) {
          console.log(`[frameio/assets] resolved root folder for project ${projectId}: ${rootId}`)
          data = await get(`${FRAMEIO_V4}/accounts/${accountId}/folders/${rootId}/children`, token)
          console.log(`[frameio/assets] V4 /folders/${rootId}/children →`, JSON.stringify(data)?.slice(0, 300))
          break
        }
      }
    }

    const raw: any[] = data?.data ?? (Array.isArray(data) ? data : [])

    const assets = raw.map((a: any) => ({
      id: a.id,
      name: a.name ?? 'Untitled',
      type: (a.type ?? a.item_type ?? 'file') as string,
      insertedAt: a.inserted_at ?? a.uploaded_at ?? null,
      commentCount: a.comment_count ?? 0,
      fps: a.fps ?? 25,
      filesize: a.filesize ?? null,
    }))

    // Folders first, then alphabetical
    assets.sort((a, b) => {
      const aF = a.type === 'folder'
      const bF = b.type === 'folder'
      if (aF && !bF) return -1
      if (!aF && bF) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ assets })
  } catch (err) {
    console.error('[frameio/assets] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}

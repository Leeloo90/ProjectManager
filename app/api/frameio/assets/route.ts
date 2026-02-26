import { NextRequest, NextResponse } from 'next/server'
import { getFrameIoToken } from '@/lib/frameio/get-token'

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

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const folderId = searchParams.get('folderId')
  const projectId = searchParams.get('projectId')

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })
  if (!folderId && !projectId) return NextResponse.json({ error: 'folderId or projectId required' }, { status: 400 })

  try {
    let targetFolderId = folderId

    if (!targetFolderId) {
      // Resolve root_folder_id from the project listing for this specific account
      const wsData = await get(`${FRAMEIO_V4}/accounts/${accountId}/workspaces`, token)
      const workspaces: any[] = wsData?.data ?? []

      for (const ws of workspaces) {
        const projList = await get(`${FRAMEIO_V4}/accounts/${accountId}/workspaces/${ws.id}/projects`, token)
        const projs: any[] = projList?.data ?? []
        const match = projs.find((p: any) => p.id === projectId)
        const rootId = match?.root_folder_id ?? match?.root_asset_id
        if (rootId) {
          console.log(`[frameio/assets] resolved root folder for project ${projectId}: ${rootId}`)
          targetFolderId = rootId
          break
        }
      }
    }

    if (!targetFolderId) {
      return NextResponse.json({ assets: [] })
    }

    // Step 1: GET /v4/accounts/{accountId}/folders/{folderId}/children — confirmed working V4 path
    const folderData = await get(
      `${FRAMEIO_V4}/accounts/${accountId}/folders/${targetFolderId}/children`,
      token
    )
    console.log(`[frameio/assets] GET /folders/children parent_id=${targetFolderId} →`, JSON.stringify(folderData)?.slice(0, 300))

    const raw: any[] = folderData?.data ?? (Array.isArray(folderData) ? folderData : [])

    // Step 2: Attempt to enrich files (non-folders) with comment_count via /memberships
    const fileIds = raw
      .filter((a: any) => (a.type ?? a.item_type) !== 'folder')
      .map((a: any) => a.id)

    const membershipMap = new Map<string, number>()

    if (fileIds.length > 0) {
      // Build query string filter: filter[asset_id][in][]=id1&filter[asset_id][in][]=id2
      const filterParams = fileIds.map((id: string) => `filter[asset_id][in][]=${id}`).join('&')
      const membershipsData = await get(
        `${FRAMEIO_V4}/accounts/${accountId}/memberships?${filterParams}`,
        token
      )
      console.log(`[frameio/assets] GET /memberships →`, JSON.stringify(membershipsData)?.slice(0, 300))

      const memberships: any[] = membershipsData?.data ?? (Array.isArray(membershipsData) ? membershipsData : [])
      for (const m of memberships) {
        if (m.asset_id && m.comment_count != null) {
          membershipMap.set(m.asset_id, m.comment_count)
        }
      }
    }

    const assets = raw.map((a: any) => ({
      id: a.id,
      name: a.name ?? 'Untitled',
      type: (a.type ?? a.item_type ?? 'file') as string,
      insertedAt: a.inserted_at ?? a.uploaded_at ?? null,
      commentCount: membershipMap.get(a.id) ?? a.comment_count ?? 0,
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

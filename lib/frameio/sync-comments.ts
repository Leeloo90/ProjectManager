import { db } from '@/lib/db'
import { projects, frameioComments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getFrameIoToken } from './get-token'
import Database from 'better-sqlite3'
import path from 'path'

const FRAMEIO_V4 = 'https://api.frame.io/v4'

export function convertFrameToTimecode(frames: number, fps: number): string {
  const totalSeconds = Math.floor(frames / fps)
  const ff = frames % fps
  const ss = totalSeconds % 60
  const mm = Math.floor(totalSeconds / 60) % 60
  const hh = Math.floor(totalSeconds / 3600)
  return [
    String(hh).padStart(2, '0'),
    String(mm).padStart(2, '0'),
    String(ss).padStart(2, '0'),
    String(ff).padStart(2, '0'),
  ].join(':')
}

async function fetchJson(url: string, token: string): Promise<any | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.error(`[frameio/sync] GET ${url} → ${res.status}:`, (await res.text()).slice(0, 200))
    return null
  }
  try { return await res.json() } catch { return null }
}

export async function syncFrameIoComments(appProjectId: string): Promise<{ newCount: number }> {
  const project = db
    .select({
      frameioProjectId: projects.frameioProjectId,
      frameioRootAssetId: projects.frameioRootAssetId,
      frameioAccountId: projects.frameioAccountId,
    })
    .from(projects)
    .where(eq(projects.id, appProjectId))
    .get()

  if (!project?.frameioProjectId) return { newCount: 0 }

  const token = await getFrameIoToken()
  if (!token) return { newCount: 0 }

  const { frameioAccountId, frameioRootAssetId } = project

  if (!frameioAccountId || !frameioRootAssetId) {
    console.error('[frameio/sync] Missing accountId or rootAssetId — re-link the project')
    return { newCount: 0 }
  }

  try {
    // Fetch root folder children using the correct V4 path
    const folderData = await fetchJson(
      `${FRAMEIO_V4}/accounts/${frameioAccountId}/folders/${frameioRootAssetId}/children`,
      token
    )
    const items: any[] = folderData?.data ?? (Array.isArray(folderData) ? folderData : [])

    // Only process files (skip folders — they have no comments themselves)
    const files = items.filter((a: any) => (a.type ?? a.item_type) !== 'folder')

    let newCount = 0
    const sqlite = new Database(path.join(process.cwd(), 'ambient-arts.db'))

    // Pre-fetch existing comment counts per asset_id so we can detect initial vs refresh per file
    const existingByAsset = sqlite.prepare(
      `SELECT frameio_asset_id, COUNT(*) as cnt FROM frameio_comments WHERE project_id = ? GROUP BY frameio_asset_id`
    ).all(appProjectId) as { frameio_asset_id: string; cnt: number }[]
    const existingCountByAsset = new Map(existingByAsset.map(r => [r.frameio_asset_id, r.cnt]))
    console.log(`[frameio/sync] existingByAsset:`, Object.fromEntries(existingCountByAsset))

    const insertStmt = sqlite.prepare(`
      INSERT OR IGNORE INTO frameio_comments
        (project_id, frameio_asset_id, frameio_asset_name, frameio_comment_id,
         commenter_name, comment_text, timecode, frameio_created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const file of files) {
      const fileId: string = file.id
      const fileName: string = file.name ?? 'Unknown Asset'
      const fps: number = file.fps ?? 25

      // If this specific asset has no prior DB records, it's an initial sync for this file.
      // New comments on it should NOT be counted as unread — they pre-existed our link.
      const isInitialSyncForAsset = !existingCountByAsset.has(fileId)

      const commentsData = await fetchJson(
        `${FRAMEIO_V4}/assets/${fileId}/comments`,
        token
      )
      const comments: any[] = commentsData?.data ?? (Array.isArray(commentsData) ? commentsData : [])

      for (const comment of comments) {
        const timecode = comment.timestamp != null
          ? convertFrameToTimecode(comment.timestamp, fps)
          : null

        const result = insertStmt.run(
          appProjectId,
          fileId,
          fileName,
          comment.id,
          comment.owner?.name ?? comment.owner?.email ?? null,
          comment.text ?? '',
          timecode,
          comment.inserted_at ?? null
        )

        // Only count as unread if it's brand new (changes === 1) AND this asset was already known
        if (result.changes === 1 && !isInitialSyncForAsset) {
          newCount++
        }
      }
    }

    sqlite.close()

    if (newCount > 0) {
      // Use SQL increment to safely add to the current unread count
      await db
        .update(projects)
        .set({ frameioUnreadComments: newCount })
        .where(eq(projects.id, appProjectId))
    }

    console.log(`[frameio/sync] done — inserted ${newCount} new comment(s)`)
    return { newCount }
  } catch (err) {
    console.error('[frameio/sync] Error:', err)
    return { newCount: 0 }
  }
}

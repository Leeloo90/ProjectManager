import { db } from '@/lib/db'
import { projects, frameioComments, integrations } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getFrameIoToken } from './get-token'
import Database from 'better-sqlite3'
import path from 'path'

const FRAMEIO_API = 'https://api.frame.io/v4'

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

export async function syncFrameIoComments(appProjectId: string): Promise<{ newCount: number }> {
  const project = db
    .select({ frameioProjectId: projects.frameioProjectId })
    .from(projects)
    .where(eq(projects.id, appProjectId))
    .get()

  if (!project?.frameioProjectId) return { newCount: 0 }

  const token = await getFrameIoToken()
  if (!token) return { newCount: 0 }

  const frameioProjectId = project.frameioProjectId

  try {
    // Get all assets in the Frame.io project
    const filesRes = await fetch(
      `${FRAMEIO_API}/projects/${frameioProjectId}/assets`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!filesRes.ok) {
      console.error('[frameio/sync] Failed to fetch assets:', await filesRes.text())
      return { newCount: 0 }
    }
    const filesData = await filesRes.json()
    console.log('[frameio/sync] assets response keys:', Object.keys(filesData))
    const files: any[] = filesData.data ?? filesData.assets ?? (Array.isArray(filesData) ? filesData : [])

    let newCount = 0

    // Use raw SQLite for INSERT OR IGNORE + changes() check
    const sqlite = new Database(path.join(process.cwd(), 'ambient-arts.db'))

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

      // Get comments for this asset
      const commentsRes = await fetch(
        `${FRAMEIO_API}/assets/${fileId}/comments`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!commentsRes.ok) continue

      const commentsData = await commentsRes.json()
      // TODO: verify exact field — may be commentsData.data or commentsData
      const comments: any[] = commentsData.data ?? commentsData ?? []

      for (const comment of comments) {
        const timecode =
          comment.timestamp != null
            ? convertFrameToTimecode(comment.timestamp, fps)
            : null

        const result = insertStmt.run(
          appProjectId,
          comment.resource_id ?? fileId,  // TODO: verify field name
          fileName,
          comment.id,
          comment.owner?.name ?? comment.owner?.email ?? null,
          comment.text ?? '',
          timecode,
          comment.inserted_at ?? null
        )

        if (result.changes === 1) newCount++
      }
    }

    sqlite.close()

    if (newCount > 0) {
      await db
        .update(projects)
        .set({
          frameioUnreadComments: sql`frameio_unread_comments + ${newCount}`,
        })
        .where(eq(projects.id, appProjectId))
    }

    return { newCount }
  } catch (err) {
    console.error('[frameio/sync] Error syncing comments:', err)
    return { newCount: 0 }
  }
}

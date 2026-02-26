'use server'
import { db } from '@/lib/db'
import { projects, frameioComments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { syncFrameIoComments } from '@/lib/frameio/sync-comments'

export async function linkFrameIoProject(
  appProjectId: string,
  frameioProjectId: string,
  frameioProjectName: string,
  frameioRootAssetId?: string | null,
  frameioWorkspaceId?: string | null
) {
  await db
    .update(projects)
    .set({
      frameioProjectId,
      frameioProjectName,
      frameioRootAssetId: frameioRootAssetId ?? null,
      frameioWorkspaceId: frameioWorkspaceId ?? null,
      frameioUnreadComments: 0,
    })
    .where(eq(projects.id, appProjectId))

  revalidatePath(`/projects/${appProjectId}`)
  revalidatePath('/projects')
}

export async function unlinkFrameIoProject(appProjectId: string) {
  await db
    .delete(frameioComments)
    .where(eq(frameioComments.projectId, appProjectId))

  await db
    .update(projects)
    .set({
      frameioProjectId: null,
      frameioProjectName: null,
      frameioUnreadComments: 0,
    })
    .where(eq(projects.id, appProjectId))

  revalidatePath(`/projects/${appProjectId}`)
  revalidatePath('/projects')
}

export async function markFrameIoCommentsRead(appProjectId: string) {
  await db
    .update(frameioComments)
    .set({ isRead: true })
    .where(eq(frameioComments.projectId, appProjectId))

  await db
    .update(projects)
    .set({ frameioUnreadComments: 0 })
    .where(eq(projects.id, appProjectId))

  revalidatePath(`/projects/${appProjectId}`)
}

export async function refreshFrameIoComments(
  appProjectId: string
): Promise<{ newCount: number }> {
  const result = await syncFrameIoComments(appProjectId)
  revalidatePath(`/projects/${appProjectId}`)
  return result
}

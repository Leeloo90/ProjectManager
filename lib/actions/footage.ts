'use server'

import { db } from '@/lib/db'
import {
  footageManagement,
  projects,
  clients,
  productionCompanies,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { buildProjectFolderStructure } from '@/lib/google-drive'

export async function getFootageByProjectId(projectId: string) {
  return db.select().from(footageManagement).where(eq(footageManagement.projectId, projectId)).get()
}

export async function createProjectFolders(projectId: string): Promise<{ error?: string }> {
  try {
    // Fetch project with client and company names
    const project = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientName: clients.name,
        companyName: productionCompanies.name,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
      .where(eq(projects.id, projectId))
      .get()

    if (!project) return { error: 'Project not found' }

    const { rootId, rootUrl, subfolders } = await buildProjectFolderStructure(
      project.companyName ?? 'Unknown Company',
      project.clientName ?? 'Unknown Client',
      project.name,
    )

    // Check if footage record already exists
    const existing = await db
      .select({ id: footageManagement.id })
      .from(footageManagement)
      .where(eq(footageManagement.projectId, projectId))
      .get()

    const now = new Date().toISOString()

    if (existing) {
      await db.update(footageManagement).set({
        driveFolderId: rootId,
        driveFolderUrl: rootUrl,
        rawFootageFolderId: subfolders.rawFootage,
        audioFolderId: subfolders.audio,
        graphicsFolderId: subfolders.graphics,
        musicFolderId: subfolders.music,
        exportsFolderId: subfolders.exports,
        projectFilesFolderId: subfolders.projectFiles,
        updatedAt: now,
      }).where(eq(footageManagement.id, existing.id))
    } else {
      await db.insert(footageManagement).values({
        id: crypto.randomUUID(),
        projectId,
        driveFolderId: rootId,
        driveFolderUrl: rootUrl,
        rawFootageFolderId: subfolders.rawFootage,
        audioFolderId: subfolders.audio,
        graphicsFolderId: subfolders.graphics,
        musicFolderId: subfolders.music,
        exportsFolderId: subfolders.exports,
        projectFilesFolderId: subfolders.projectFiles,
      })
    }

    revalidatePath(`/projects/${projectId}/footage`)
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: message }
  }
}

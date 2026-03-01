import { google } from 'googleapis'
import { db } from '@/lib/db'
import { googleAuth } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

type DriveClient = ReturnType<typeof google.drive>

export async function getDriveClient(): Promise<DriveClient> {
  const auth = await db.select().from(googleAuth).where(eq(googleAuth.id, 'singleton')).get()
  if (!auth?.refreshToken) {
    throw new Error('Google Drive not connected')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )

  oauth2Client.setCredentials({
    refresh_token: auth.refreshToken,
    access_token: auth.accessToken ?? undefined,
    expiry_date: auth.expiresAt ?? undefined,
  })

  // Persist refreshed tokens automatically
  oauth2Client.on('tokens', async (tokens) => {
    await db.update(googleAuth).set({
      accessToken: tokens.access_token ?? auth.accessToken,
      expiresAt: tokens.expiry_date ?? auth.expiresAt,
      updatedAt: new Date().toISOString(),
    }).where(eq(googleAuth.id, 'singleton'))
  })

  return google.drive({ version: 'v3', auth: oauth2Client })
}

export async function findOrCreateFolder(drive: DriveClient, name: string, parentId: string | null): Promise<string> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : ''
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false${parentClause}`

  const res = await drive.files.list({
    q,
    fields: 'files(id)',
    spaces: 'drive',
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : [],
    },
    fields: 'id',
  })

  return created.data.id!
}

export type FolderStructure = {
  rootId: string
  rootUrl: string
  subfolders: {
    rawFootage: string
    audio: string
    graphics: string
    music: string
    exports: string
    projectFiles: string
  }
}

export async function buildProjectFolderStructure(
  companyName: string,
  clientName: string,
  projectName: string,
): Promise<FolderStructure> {
  const drive = await getDriveClient()

  const companyId = await findOrCreateFolder(drive, companyName, null)
  const clientId = await findOrCreateFolder(drive, clientName, companyId)
  const projectId = await findOrCreateFolder(drive, projectName, clientId)

  const [rawFootage, audio, graphics, music, exports_, projectFiles] = await Promise.all([
    findOrCreateFolder(drive, 'Proxy Footage', projectId),
    findOrCreateFolder(drive, 'Audio', projectId),
    findOrCreateFolder(drive, 'Graphics', projectId),
    findOrCreateFolder(drive, 'Music', projectId),
    findOrCreateFolder(drive, 'Exports', projectId),
    findOrCreateFolder(drive, 'Project Files', projectId),
  ])

  return {
    rootId: projectId,
    rootUrl: `https://drive.google.com/drive/folders/${projectId}`,
    subfolders: {
      rawFootage,
      audio,
      graphics,
      music,
      exports: exports_,
      projectFiles,
    },
  }
}

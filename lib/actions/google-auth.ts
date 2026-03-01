'use server'

import { db } from '@/lib/db'
import { googleAuth } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function getGoogleAuthStatus(): Promise<{ connected: boolean }> {
  const auth = await db.select({ id: googleAuth.id, refreshToken: googleAuth.refreshToken })
    .from(googleAuth)
    .where(eq(googleAuth.id, 'singleton'))
    .get()
  return { connected: !!auth?.refreshToken }
}

export async function disconnectGoogle(): Promise<void> {
  await db.delete(googleAuth).where(eq(googleAuth.id, 'singleton'))
  revalidatePath('/settings')
}

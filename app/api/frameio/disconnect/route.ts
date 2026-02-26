import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  await db
    .update(integrations)
    .set({ isActive: false, accessToken: null, refreshToken: null })
    .where(eq(integrations.service, 'frameio'))

  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { businessSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  await db
    .update(businessSettings)
    .set({ gmailRefreshToken: null })
    .where(eq(businessSettings.id, 'singleton'))

  return NextResponse.json({ ok: true })
}

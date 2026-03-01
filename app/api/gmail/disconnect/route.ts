import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { googleAuth } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  await db.delete(googleAuth).where(eq(googleAuth.id, 'singleton'))
  return NextResponse.json({ ok: true })
}

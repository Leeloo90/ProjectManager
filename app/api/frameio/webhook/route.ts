import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { syncFrameIoComments } from '@/lib/frameio/sync-comments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.FRAMEIO_WEBHOOK_SECRET
  if (!secret) return true // skip verification if no secret configured
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  return `sha256=${expected}` === signature
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-frameio-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle comment-related events
  const eventType: string = event.type ?? ''
  if (!eventType.toLowerCase().includes('comment')) {
    return NextResponse.json({ ok: true })
  }

  // Find the Frame.io project ID from the event payload
  // TODO: verify exact field path against live Frame.io V4 webhook docs
  const frameioProjectId: string | null =
    event.resource?.project_id ?? event.project_id ?? event.data?.project_id ?? null

  if (!frameioProjectId) {
    return NextResponse.json({ ok: true })
  }

  // Find which app project is linked to this Frame.io project
  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.frameioProjectId, frameioProjectId))
    .get()

  if (!project) {
    return NextResponse.json({ ok: true })
  }

  // Sync comments for the linked project
  await syncFrameIoComments(project.id)

  return NextResponse.json({ ok: true })
}

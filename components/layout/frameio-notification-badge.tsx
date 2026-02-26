import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export async function FrameioNotificationBadge() {
  const result = db
    .select({ total: sql<number>`COALESCE(SUM(frameio_unread_comments), 0)` })
    .from(projects)
    .get()

  const total = result?.total ?? 0
  if (!total || total === 0) return null

  return (
    <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
      {total > 99 ? '99+' : total}
    </span>
  )
}

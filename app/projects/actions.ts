'use server'
import { db } from '@/lib/db'
import { projects, deliverables, shootDetails, revisions, activityLog, pricingConfig, businessSettings, todoGroups, todoTasks } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { generateId, getDurationBracket, editPriceKey, colourGradingKey, subtitleKey } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { getFrameioToken, refreshAccessToken } from '@/lib/frameio/auth'

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(formData: FormData) {
  const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
  const id = generateId()
  const name = formData.get('name') as string
  await db.insert(projects).values({
    id,
    name,
    productionCompanyId: formData.get('productionCompanyId') as string,
    clientId: formData.get('clientId') as string,
    startDate: formData.get('startDate') as string,
    deadline: formData.get('deadline') as string,
    status: 'enquiry',
    includedRevisionRounds: settings?.defaultRevisionRounds ?? 2,
    notes: formData.get('notes') as string || null,
  })
  await db.insert(activityLog).values({
    id: generateId(),
    projectId: id,
    eventType: 'project_created',
    description: `Project "${name}" created`,
  })
  revalidatePath('/projects')
  return id
}

export async function updateProject(id: string, formData: FormData) {
  const name = formData.get('name') as string
  await db.update(projects)
    .set({
      name,
      productionCompanyId: formData.get('productionCompanyId') as string,
      clientId: formData.get('clientId') as string,
      startDate: formData.get('startDate') as string,
      deadline: formData.get('deadline') as string,
      includedRevisionRounds: parseInt(formData.get('includedRevisionRounds') as string) || 2,
      drivefinalsLink: formData.get('drivefinalsLink') as string || null,
      driveArchiveLink: formData.get('driveArchiveLink') as string || null,
      notes: formData.get('notes') as string || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(projects.id, id))
  revalidatePath(`/projects/${id}`)
  revalidatePath('/projects')
}

export async function updateProjectStatus(id: string, status: string) {
  const project = await db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) return
  await db.update(projects)
    .set({ status: status as any, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, id))
  await db.insert(activityLog).values({
    id: generateId(),
    projectId: id,
    eventType: 'status_changed',
    description: `Project "${project.name}" status changed to ${status}`,
  })
  revalidatePath(`/projects/${id}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

export async function deleteProject(id: string) {
  const project = await db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) return
  if (['invoiced', 'paid'].includes(project.status)) {
    throw new Error('Cannot delete an invoiced or paid project.')
  }
  await db.delete(projects).where(eq(projects.id, id))
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

// ─── Deliverables ─────────────────────────────────────────────────────────────

async function getPricingMap() {
  const configs = await db.select().from(pricingConfig).all()
  return Object.fromEntries(configs.map(c => [c.configKey, c.configValue]))
}

export async function calculateDeliverableCost(formData: FormData): Promise<number> {
  const pricing = await getPricingMap()

  const videoLengthSeconds = parseInt(formData.get('videoLengthSeconds') as string) || 0
  const editType = formData.get('editType') as 'basic' | 'advanced' | 'colour_only'
  const colourGrading = formData.get('colourGrading') as 'none' | 'standard' | 'advanced'
  const subtitles = formData.get('subtitles') as 'none' | 'basic' | 'styled'
  const additionalFormats = parseInt(formData.get('additionalFormats') as string) || 0
  const hasCustomMusic = formData.get('hasCustomMusic') === 'true'
  const customMusicCost = parseFloat(formData.get('customMusicCost') as string) || 0
  const hasCustomGraphics = formData.get('hasCustomGraphics') === 'true'
  const customGraphicsCost = parseFloat(formData.get('customGraphicsCost') as string) || 0
  const rushFeeType = formData.get('rushFeeType') as 'none' | 'standard' | 'emergency'

  const bracket = getDurationBracket(videoLengthSeconds)

  let basePrice = 0
  if (editType === 'colour_only') {
    // Colour Only uses colour grading table
    if (colourGrading !== 'none') {
      basePrice = pricing[colourGradingKey(colourGrading as 'standard' | 'advanced', bracket)] || 0
    }
  } else {
    basePrice = pricing[editPriceKey(editType as 'basic' | 'advanced', bracket)] || 0
  }

  let total = basePrice

  // Colour grading add-on (only for basic/advanced edits)
  if (editType !== 'colour_only' && colourGrading !== 'none') {
    total += pricing[colourGradingKey(colourGrading as 'standard' | 'advanced', bracket)] || 0
  }

  // Subtitles
  if (subtitles !== 'none') {
    const basicSubPrice = pricing[`subtitles_basic_${bracket}`] || 0
    if (subtitles === 'basic') {
      total += basicSubPrice
    } else if (subtitles === 'styled') {
      const multiplier = pricing['styled_subtitles_multiplier'] || 2
      total += basicSubPrice * multiplier
    }
  }

  // Multi-format
  if (additionalFormats > 0) {
    const rate = pricing['multiformat_additional_rate'] || 0.20
    total += additionalFormats * rate * basePrice
  }

  // Custom music
  if (hasCustomMusic) total += customMusicCost

  // Custom graphics
  if (hasCustomGraphics) total += customGraphicsCost

  // Rush fee (applied to total BEFORE rush, excluding shoot)
  if (rushFeeType === 'standard') {
    total *= 1 + (pricing['rush_standard'] || 0.25)
  } else if (rushFeeType === 'emergency') {
    total *= 1 + (pricing['rush_emergency'] || 0.50)
  }

  return Math.round(total * 100) / 100
}

export async function saveDeliverable(projectId: string, deliverableId: string | null, formData: FormData) {
  const cost = await calculateDeliverableCost(formData)
  const videoLengthSeconds = parseInt(formData.get('videoLengthSeconds') as string) || 0
  const bracket = getDurationBracket(videoLengthSeconds)

  const data = {
    projectId,
    name: formData.get('name') as string,
    videoLengthSeconds,
    durationBracket: bracket as any,
    primaryFormat: formData.get('primaryFormat') as any,
    editType: formData.get('editType') as any,
    colourGrading: (formData.get('colourGrading') as any) || 'none',
    subtitles: (formData.get('subtitles') as any) || 'none',
    additionalFormats: parseInt(formData.get('additionalFormats') as string) || 0,
    hasCustomMusic: formData.get('hasCustomMusic') === 'true',
    customMusicCost: parseFloat(formData.get('customMusicCost') as string) || null,
    hasCustomGraphics: formData.get('hasCustomGraphics') === 'true',
    customGraphicsDescription: formData.get('customGraphicsDescription') as string || null,
    customGraphicsCost: parseFloat(formData.get('customGraphicsCost') as string) || null,
    rushFeeType: (formData.get('rushFeeType') as any) || 'none',
    calculatedCost: cost,
    notes: formData.get('notes') as string || null,
  }

  if (deliverableId) {
    await db.update(deliverables).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(deliverables.id, deliverableId))
  } else {
    await db.insert(deliverables).values({ id: generateId(), ...data })
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/deliverables`)
}

export async function deleteDeliverable(id: string, projectId: string) {
  await db.delete(deliverables).where(eq(deliverables.id, id))
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/deliverables`)
}

// ─── Shoot Details ────────────────────────────────────────────────────────────

export async function saveShootDetails(projectId: string, shootId: string | null, formData: FormData) {
  const pricing = await getPricingMap()

  const shootType = formData.get('shootType') as 'half_day' | 'full_day'
  const cameraBody = formData.get('cameraBody') as 'a7siii' | 'a7iii'
  const hasSecondShooter = formData.get('hasSecondShooter') === 'true'
  const secondShooterType = formData.get('secondShooterType') as 'half_day' | 'full_day' | null || null
  const hasSoundKit = formData.get('hasSoundKit') === 'true'
  const soundKitType = formData.get('soundKitType') as 'half_day' | 'full_day' | null || null
  const hasLighting = formData.get('hasLighting') === 'true'
  const lightingType = formData.get('lightingType') as 'half_day' | 'full_day' | null || null
  const hasGimbal = formData.get('hasGimbal') === 'true'
  const gimbalType = formData.get('gimbalType') as 'half_day' | 'full_day' | null || null
  const additionalEquipmentRaw = formData.get('additionalEquipment') as string
  const travelMethod = formData.get('travelMethod') as 'none' | 'driving' | 'flying'
  const shootLocation = formData.get('shootLocation') as string || null
  const distanceKm = parseFloat(formData.get('distanceKm') as string) || null
  const airfareCost = parseFloat(formData.get('airfareCost') as string) || null
  const accommodationNights = parseInt(formData.get('accommodationNights') as string) || null
  const accommodationPerNight = parseFloat(formData.get('accommodationPerNight') as string) || null
  const shootDate = formData.get('shootDate') as string || null
  const shootLabel = formData.get('shootLabel') as string || null

  const dayKey = shootType === 'half_day' ? 'half' : 'full'

  // Calculate shoot cost
  let shootCost = pricing[`shoot_day_${dayKey}`] || 0
  shootCost += pricing[`camera_${cameraBody}_${dayKey}`] || 0
  if (hasSecondShooter && secondShooterType) {
    const sk = secondShooterType === 'half_day' ? 'half' : 'full'
    shootCost += pricing[`second_shooter_${sk}`] || 0
  }
  if (hasSoundKit && soundKitType) {
    const sk = soundKitType === 'half_day' ? 'half' : 'full'
    shootCost += pricing[`sound_kit_${sk}`] || 0
  }
  if (hasLighting && lightingType) {
    const sk = lightingType === 'half_day' ? 'half' : 'full'
    shootCost += pricing[`lighting_${sk}`] || 0
  }
  if (hasGimbal && gimbalType) {
    const sk = gimbalType === 'half_day' ? 'half' : 'full'
    shootCost += pricing[`gimbal_${sk}`] || 0
  }

  // Additional equipment
  let additionalEquipment = null
  try {
    const items = JSON.parse(additionalEquipmentRaw || '[]')
    if (items.length > 0) {
      additionalEquipment = JSON.stringify(items)
      for (const item of items) {
        shootCost += parseFloat(item.cost) || 0
      }
    }
  } catch {}

  // Travel
  if (travelMethod === 'driving' && distanceKm) {
    const businessSettings_ = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
    const perKm = businessSettings_?.perKmTravelRate ?? 5
    shootCost += distanceKm * 2 * perKm // return trip
  } else if (travelMethod === 'flying') {
    shootCost += airfareCost || 0
  }
  if (accommodationNights && accommodationPerNight) {
    shootCost += accommodationNights * accommodationPerNight
  }

  const data = {
    projectId,
    shootDate,
    shootLabel,
    shootType,
    cameraBody,
    hasSecondShooter,
    secondShooterType: hasSecondShooter ? secondShooterType : null,
    hasSoundKit,
    soundKitType: hasSoundKit ? soundKitType : null,
    hasLighting,
    lightingType: hasLighting ? lightingType : null,
    hasGimbal,
    gimbalType: hasGimbal ? gimbalType : null,
    additionalEquipment,
    travelMethod,
    shootLocation,
    distanceKm,
    airfareCost,
    accommodationNights,
    accommodationPerNight,
    calculatedShootCost: Math.round(shootCost * 100) / 100,
  }

  if (shootId) {
    await db.update(shootDetails).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(shootDetails.id, shootId), eq(shootDetails.projectId, projectId)))
  } else {
    await db.insert(shootDetails).values({ id: generateId(), ...data })
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/shoots`)
}

export async function deleteShootDetails(shootId: string, projectId: string) {
  await db.delete(shootDetails).where(and(eq(shootDetails.id, shootId), eq(shootDetails.projectId, projectId)))
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/shoots`)
}

// ─── Revisions ────────────────────────────────────────────────────────────────

export async function updateRevisionNotes(revisionId: string, notes: string) {
  await db.update(revisions)
    .set({ notes, updatedAt: new Date().toISOString() })
    .where(eq(revisions.id, revisionId))
}

export async function deleteRevision(revisionId: string, projectId: string) {
  const target = await db.select().from(revisions).where(eq(revisions.id, revisionId)).get()
  if (!target) return

  await db.delete(revisions).where(eq(revisions.id, revisionId))

  // Renumber siblings in the same deliverable group
  const groupWhere = and(
    eq(revisions.projectId, projectId),
    target.deliverableId
      ? eq(revisions.deliverableId, target.deliverableId)
      : isNull(revisions.deliverableId),
  )
  const remaining = await db.select().from(revisions).where(groupWhere).orderBy(revisions.orderId).all()

  const intRevs = remaining.filter(r => r.category === 'INT')
  const extRevs = remaining.filter(r => r.category === 'EXT')
  for (let i = 0; i < intRevs.length; i++) {
    await db.update(revisions).set({ intNumber: i + 1 }).where(eq(revisions.id, intRevs[i].id))
  }
  for (let i = 0; i < extRevs.length; i++) {
    await db.update(revisions).set({ extNumber: i + 1 }).where(eq(revisions.id, extRevs[i].id))
  }

  // Reset deliverable post-status to not_started only if no revisions remain
  if (target.deliverableId && remaining.length === 0) {
    await db.update(deliverables)
      .set({ postStatus: 'not_started', updatedAt: new Date().toISOString() })
      .where(eq(deliverables.id, target.deliverableId))
  }

  revalidatePath(`/projects/${projectId}/revisions`)
}

export async function addRevisionEntry(
  projectId: string,
  data: {
    category: 'INT' | 'EXT'
    title: string
    deliverableId?: string | null
    frameioAssetId?: string
    frameioShareLink?: string
    thumbnailUrl?: string
  },
) {
  // orderId is project-wide (chronological across all groups)
  const allProjectRevisions = await db.select({ orderId: revisions.orderId })
    .from(revisions).where(eq(revisions.projectId, projectId)).all()
  const orderId = allProjectRevisions.length + 1

  // int/ext numbering scoped to the same deliverable group (null = unassigned)
  const groupRevisions = await db.select()
    .from(revisions)
    .where(
      and(
        eq(revisions.projectId, projectId),
        data.deliverableId
          ? eq(revisions.deliverableId, data.deliverableId)
          : isNull(revisions.deliverableId),
      )
    )
    .all()
  const intCount = groupRevisions.filter(r => r.category === 'INT').length
  const extCount = groupRevisions.filter(r => r.category === 'EXT').length

  await db.insert(revisions).values({
    id: generateId(),
    projectId,
    deliverableId: data.deliverableId ?? null,
    orderId,
    category: data.category,
    intNumber: data.category === 'INT' ? intCount + 1 : null,
    extNumber: data.category === 'EXT' ? extCount + 1 : null,
    title: data.title,
    frameioAssetId: data.frameioAssetId ?? null,
    frameioShareLink: data.frameioShareLink ?? null,
    thumbnailUrl: data.thumbnailUrl ?? null,
  })

  // Auto-update deliverable postStatus
  if (data.deliverableId) {
    const newStatus = data.category === 'INT' ? 'awaiting_feedback_int' : 'awaiting_feedback_ext'
    await db.update(deliverables)
      .set({ postStatus: newStatus, updatedAt: new Date().toISOString() })
      .where(eq(deliverables.id, data.deliverableId))
    revalidatePath(`/projects/${projectId}`)
  }

  revalidatePath(`/projects/${projectId}/revisions`)
}

export async function assignRevisionToDeliverable(
  revisionId: string,
  deliverableId: string | null,
  projectId: string,
) {
  await db.update(revisions)
    .set({ deliverableId, updatedAt: new Date().toISOString() })
    .where(eq(revisions.id, revisionId))
  revalidatePath(`/projects/${projectId}/revisions`)
}

export async function promoteRevision(revisionId: string, projectId: string) {
  // Fetch target to know its deliverable group
  const target = await db.select().from(revisions).where(eq(revisions.id, revisionId)).get()
  if (!target || target.category !== 'INT') return

  // Scope all operations to the same deliverable group
  const groupWhere = and(
    eq(revisions.projectId, projectId),
    target.deliverableId
      ? eq(revisions.deliverableId, target.deliverableId)
      : isNull(revisions.deliverableId),
  )
  const group = await db.select().from(revisions).where(groupWhere).all()

  const extCount = group.filter(r => r.category === 'EXT').length
  await db.update(revisions)
    .set({ category: 'EXT', intNumber: null, extNumber: extCount + 1, updatedAt: new Date().toISOString() })
    .where(eq(revisions.id, revisionId))

  // Renumber remaining INT rows in this group
  const remainingInt = group
    .filter(r => r.category === 'INT' && r.id !== revisionId)
    .sort((a, b) => a.orderId - b.orderId)
  for (let i = 0; i < remainingInt.length; i++) {
    await db.update(revisions)
      .set({ intNumber: i + 1, updatedAt: new Date().toISOString() })
      .where(eq(revisions.id, remainingInt[i].id))
  }
  revalidatePath(`/projects/${projectId}/revisions`)
}

export async function demoteRevision(revisionId: string, projectId: string) {
  const target = await db.select().from(revisions).where(eq(revisions.id, revisionId)).get()
  if (!target || target.category !== 'EXT') return

  const groupWhere = and(
    eq(revisions.projectId, projectId),
    target.deliverableId
      ? eq(revisions.deliverableId, target.deliverableId)
      : isNull(revisions.deliverableId),
  )
  const group = await db.select().from(revisions).where(groupWhere).all()

  const intCount = group.filter(r => r.category === 'INT').length
  await db.update(revisions)
    .set({ category: 'INT', extNumber: null, intNumber: intCount + 1, updatedAt: new Date().toISOString() })
    .where(eq(revisions.id, revisionId))

  // Renumber remaining EXT rows in this group
  const remainingExt = group
    .filter(r => r.category === 'EXT' && r.id !== revisionId)
    .sort((a, b) => a.orderId - b.orderId)
  for (let i = 0; i < remainingExt.length; i++) {
    await db.update(revisions)
      .set({ extNumber: i + 1, updatedAt: new Date().toISOString() })
      .where(eq(revisions.id, remainingExt[i].id))
  }
  revalidatePath(`/projects/${projectId}/revisions`)
}

export async function refreshRevisionComments(projectId: string) {
  const primaryAccountId = process.env.FRAMEIO_ACCOUNT_ID
  if (!primaryAccountId) return

  const all = await db.select().from(revisions).where(eq(revisions.projectId, projectId)).all()
  const withAssets = all.filter(r => r.frameioAssetId)
  if (withAssets.length === 0) return

  let token: string
  try {
    token = await getFrameioToken()
  } catch {
    return
  }

  const BASE = 'https://api.frame.io/v4'

  // Mirror exactly what /api/frameio/comments does: paginate with include=owner,replies,
  // handle 401 refresh, and fall back to other accounts on 404.
  async function fetchCommentCount(accountId: string, fileId: string): Promise<number | null> {
    let count = 0
    let cursor: string | null =
      `${BASE}/accounts/${accountId}/files/${fileId}/comments?include=owner,replies`

    while (cursor) {
      const url = cursor
      cursor = null
      let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

      if (res.status === 401) {
        try { token = await refreshAccessToken() } catch { return null }
        res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      }
      if (!res.ok) return res.status === 404 ? null : count

      const data = await res.json()
      const items: unknown[] = data.data ?? (Array.isArray(data) ? data : [])
      count += items.length

      const nextPath: string | undefined = data.links?.next
      if (nextPath) cursor = nextPath.startsWith('http') ? nextPath : `${BASE}${nextPath}`
    }
    return count
  }

  // Fetch all accounts once — used as fallback when a file returns 404 on the primary account
  let allAccounts: { id: string }[] = []
  try {
    const accountsRes = await fetch(`${BASE}/accounts`, { headers: { Authorization: `Bearer ${token}` } })
    if (accountsRes.ok) {
      const accountsData = await accountsRes.json()
      allAccounts = accountsData.data ?? []
    }
  } catch { /* ignore */ }

  async function fetchFileMeta(accountId: string, fileId: string): Promise<string | null> {
    const res = await fetch(`${BASE}/accounts/${accountId}/files/${fileId}?include=media_links.thumbnail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    const file = data.data ?? {}
    return file.media_links?.thumbnail?.download_url ?? file.cover_image_url ?? file.thumb_url ?? null
  }

  for (const revision of withAssets) {
    try {
      let count = await fetchCommentCount(primaryAccountId, revision.frameioAssetId!)
      let thumbUrl = await fetchFileMeta(primaryAccountId, revision.frameioAssetId!)

      // 404 means the file is on a different account — try all accounts
      if (count === null || thumbUrl === null) {
        for (const account of allAccounts) {
          if (account.id === primaryAccountId) continue
          if (count === null) {
            const alt = await fetchCommentCount(account.id, revision.frameioAssetId!)
            if (alt !== null) count = alt
          }
          if (thumbUrl === null) {
            const altThumb = await fetchFileMeta(account.id, revision.frameioAssetId!)
            if (altThumb !== null) thumbUrl = altThumb
          }
          if (count !== null && thumbUrl !== null) break
        }
      }

      if (count !== null || thumbUrl !== null) {
        await db.update(revisions)
          .set({
            ...(count !== null ? { commentCount: count } : {}),
            ...(thumbUrl !== null ? { thumbnailUrl: thumbUrl } : {}),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(revisions.id, revision.id))
      }
    } catch {
      // skip this revision on error
    }
  }
  // Auto-advance postStatus for deliverables that now have feedback
  const freshRevisions = await db.select().from(revisions).where(eq(revisions.projectId, projectId)).all()
  const projectDelivs = await db.select({ id: deliverables.id, postStatus: deliverables.postStatus })
    .from(deliverables).where(eq(deliverables.projectId, projectId)).all()
  for (const d of projectDelivs) {
    if (d.postStatus === 'awaiting_feedback_int') {
      const latestInt = freshRevisions
        .filter(r => r.deliverableId === d.id && r.category === 'INT')
        .sort((a, b) => b.orderId - a.orderId)[0]
      if (latestInt && (latestInt.commentCount ?? 0) > 0) {
        await db.update(deliverables).set({ postStatus: 'feedback_available_int', updatedAt: new Date().toISOString() }).where(eq(deliverables.id, d.id))
      }
    } else if (d.postStatus === 'awaiting_feedback_ext') {
      const latestExt = freshRevisions
        .filter(r => r.deliverableId === d.id && r.category === 'EXT')
        .sort((a, b) => b.orderId - a.orderId)[0]
      if (latestExt && (latestExt.commentCount ?? 0) > 0) {
        await db.update(deliverables).set({ postStatus: 'feedback_available_ext', updatedAt: new Date().toISOString() }).where(eq(deliverables.id, d.id))
      }
    }
  }

  revalidatePath(`/projects/${projectId}/revisions`)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateDeliverableNameAndCost(deliverableId: string, name: string, calculatedCost: number) {
  const d = db.select({ projectId: deliverables.projectId }).from(deliverables).where(eq(deliverables.id, deliverableId)).get()
  await db.update(deliverables)
    .set({ name, calculatedCost, updatedAt: new Date().toISOString() })
    .where(eq(deliverables.id, deliverableId))
  if (d?.projectId) {
    revalidatePath(`/projects/${d.projectId}`)
    revalidatePath('/projects')
    revalidatePath('/dashboard')
  }
}

export async function advanceDeliverablePostStatus(deliverableId: string, projectId: string): Promise<void> {
  const d = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).get()
  if (!d) return
  const status = d.postStatus ?? 'not_started'

  if (status === 'awaiting_feedback_int' || status === 'feedback_available_int') {
    // Promote the latest INT revision to EXT
    const groupRevs = await db.select().from(revisions)
      .where(and(eq(revisions.projectId, projectId), eq(revisions.deliverableId, deliverableId)))
      .all()
    const latestInt = groupRevs
      .filter(r => r.category === 'INT')
      .sort((a, b) => b.orderId - a.orderId)[0]
    if (latestInt) await promoteRevision(latestInt.id, projectId)
    await db.update(deliverables)
      .set({ postStatus: 'awaiting_feedback_ext', updatedAt: new Date().toISOString() })
      .where(eq(deliverables.id, deliverableId))
  } else if (status === 'awaiting_feedback_ext' || status === 'feedback_available_ext') {
    await db.update(deliverables)
      .set({ postStatus: 'approved', updatedAt: new Date().toISOString() })
      .where(eq(deliverables.id, deliverableId))
    // Check if all deliverables on this project are now approved
    const allDelivs = await db.select({ postStatus: deliverables.postStatus })
      .from(deliverables).where(eq(deliverables.projectId, projectId)).all()
    const allApproved = allDelivs.length > 0 && allDelivs.every(d => d.postStatus === 'approved')
    if (allApproved) {
      const proj = await db.select({ status: projects.status }).from(projects).where(eq(projects.id, projectId)).get()
      if (proj && !['final_delivery', 'finished', 'invoiced', 'paid'].includes(proj.status)) {
        await db.update(projects)
          .set({ status: 'final_delivery', updatedAt: new Date().toISOString() })
          .where(eq(projects.id, projectId))
        await db.insert(activityLog).values({
          id: generateId(),
          projectId,
          eventType: 'status_changed',
          description: 'All deliverables approved — project advanced to Final Delivery',
        })
      }
    }
  } else if (status === 'approved') {
    // Allow reopening for another revision cycle
    await db.update(deliverables)
      .set({ postStatus: 'awaiting_feedback_int', updatedAt: new Date().toISOString() })
      .where(eq(deliverables.id, deliverableId))
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/revisions`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

// ─── Frame.io ─────────────────────────────────────────────────────────────────

export async function linkFrameioProject(
  projectId: string,
  frameioProjectId: string,
  frameioRootFolderId: string
): Promise<void> {
  await db.update(projects)
    .set({ frameioProjectId, frameioRootFolderId, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

export async function unlinkFrameioProject(projectId: string): Promise<void> {
  await db.update(projects)
    .set({ frameioProjectId: null, frameioRootFolderId: null, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Todo ─────────────────────────────────────────────────────────────────────

export async function getTodoData(projectId: string) {
  const groups = await db.select().from(todoGroups).where(eq(todoGroups.projectId, projectId)).orderBy(todoGroups.position).all()
  const tasks = await db.select().from(todoTasks).where(eq(todoTasks.projectId, projectId)).orderBy(todoTasks.position).all()
  return { groups, tasks }
}

export async function addTodoGroup(projectId: string, title: string, deliverableId?: string) {
  const existingGroups = await db.select({ position: todoGroups.position }).from(todoGroups).where(eq(todoGroups.projectId, projectId)).all()
  const existingStandalone = await db.select({ position: todoTasks.position }).from(todoTasks).where(and(eq(todoTasks.projectId, projectId), isNull(todoTasks.groupId))).all()
  const allPositions = [...existingGroups.map(g => g.position), ...existingStandalone.map(t => t.position)]
  const maxPos = allPositions.length > 0 ? Math.max(...allPositions) : 0
  await db.insert(todoGroups).values({
    id: crypto.randomUUID(),
    projectId,
    deliverableId: deliverableId ?? null,
    title,
    position: maxPos + 1,
  })
  revalidatePath(`/projects/${projectId}/todo`)
  revalidatePath(`/projects/${projectId}`)
}

export async function addTodoTask(projectId: string, title: string, groupId?: string) {
  const existing = await db.select({ position: todoTasks.position }).from(todoTasks)
    .where(groupId
      ? and(eq(todoTasks.projectId, projectId), eq(todoTasks.groupId, groupId))
      : and(eq(todoTasks.projectId, projectId), isNull(todoTasks.groupId))
    ).all()
  let maxPos = existing.length > 0 ? Math.max(...existing.map(t => t.position)) : 0
  // For standalone tasks, use global position space
  if (!groupId) {
    const existingGroups = await db.select({ position: todoGroups.position }).from(todoGroups).where(eq(todoGroups.projectId, projectId)).all()
    const allPositions = [...existing.map(t => t.position), ...existingGroups.map(g => g.position)]
    maxPos = allPositions.length > 0 ? Math.max(...allPositions) : 0
  }
  await db.insert(todoTasks).values({
    id: crypto.randomUUID(),
    projectId,
    groupId: groupId ?? null,
    title,
    completed: false,
    position: maxPos + 1,
  })
  revalidatePath(`/projects/${projectId}/todo`)
  revalidatePath(`/projects/${projectId}`)
}

const DEFAULT_TASK_TITLES = ['First Draft', 'Revision', 'Colour Grade', 'Sound', 'Finishing', 'Masters', 'Upload']

export async function addDefaultTasks(groupId: string, projectId: string, deliverableId: string) {
  const deliverable = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).get()
  const existingTasks = await db.select().from(todoTasks).where(eq(todoTasks.groupId, groupId)).all()
  const existingTitles = new Set(existingTasks.map(t => t.title))
  const defaults = [...DEFAULT_TASK_TITLES]
  if (deliverable && (deliverable.additionalFormats ?? 0) > 0) defaults.push('Variations')
  const toAdd = defaults.filter(t => !existingTitles.has(t))
  let nextPos = existingTasks.length > 0 ? Math.max(...existingTasks.map(t => t.position)) : 0
  for (const title of toAdd) {
    nextPos++
    await db.insert(todoTasks).values({
      id: crypto.randomUUID(),
      projectId,
      groupId,
      title,
      completed: false,
      position: nextPos,
    })
  }
  revalidatePath(`/projects/${projectId}/todo`)
}

export async function toggleTodoTask(taskId: string, projectId: string) {
  const task = await db.select().from(todoTasks).where(eq(todoTasks.id, taskId)).get()
  if (!task) return
  await db.update(todoTasks).set({ completed: !task.completed, updatedAt: new Date().toISOString() }).where(eq(todoTasks.id, taskId))
  revalidatePath(`/projects/${projectId}/todo`)
  revalidatePath(`/projects/${projectId}`)
}

export async function renameTodoItem(id: string, type: 'group' | 'task', newTitle: string, projectId: string) {
  if (type === 'group') {
    await db.update(todoGroups).set({ title: newTitle, updatedAt: new Date().toISOString() }).where(eq(todoGroups.id, id))
  } else {
    await db.update(todoTasks).set({ title: newTitle, updatedAt: new Date().toISOString() }).where(eq(todoTasks.id, id))
  }
  revalidatePath(`/projects/${projectId}/todo`)
}

export async function deleteTodoGroup(groupId: string, projectId: string) {
  await db.delete(todoGroups).where(eq(todoGroups.id, groupId))
  revalidatePath(`/projects/${projectId}/todo`)
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteTodoTask(taskId: string, projectId: string) {
  await db.delete(todoTasks).where(eq(todoTasks.id, taskId))
  revalidatePath(`/projects/${projectId}/todo`)
  revalidatePath(`/projects/${projectId}`)
}

export async function reorderTodoItems(
  projectId: string,
  updates: { id: string; type: 'group' | 'task'; position: number; groupId?: string }[]
) {
  for (const u of updates) {
    if (u.type === 'group') {
      await db.update(todoGroups).set({ position: u.position, updatedAt: new Date().toISOString() }).where(eq(todoGroups.id, u.id))
    } else {
      await db.update(todoTasks).set({
        position: u.position,
        groupId: u.groupId !== undefined ? u.groupId : undefined,
        updatedAt: new Date().toISOString(),
      }).where(eq(todoTasks.id, u.id))
    }
  }
  revalidatePath(`/projects/${projectId}/todo`)
}

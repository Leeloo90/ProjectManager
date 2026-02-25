'use server'
import { db } from '@/lib/db'
import { projects, deliverables, shootDetails, revisions, activityLog, pricingConfig, businessSettings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId, getDurationBracket, editPriceKey, colourGradingKey, subtitleKey } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

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
      frameIoLink: formData.get('frameIoLink') as string || null,
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
}

export async function deleteDeliverable(id: string, projectId: string) {
  await db.delete(deliverables).where(eq(deliverables.id, id))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Shoot Details ────────────────────────────────────────────────────────────

export async function saveShootDetails(projectId: string, formData: FormData) {
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

  const existing = await db.select().from(shootDetails).where(eq(shootDetails.projectId, projectId)).get()

  const data = {
    projectId,
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

  if (existing) {
    await db.update(shootDetails).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(shootDetails.projectId, projectId))
  } else {
    await db.insert(shootDetails).values({ id: generateId(), ...data })
  }

  revalidatePath(`/projects/${projectId}`)
}

export async function deleteShootDetails(projectId: string) {
  await db.delete(shootDetails).where(eq(shootDetails.projectId, projectId))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Revisions ────────────────────────────────────────────────────────────────

export async function addRevision(projectId: string, formData: FormData) {
  const existingRevisions = await db.select().from(revisions).where(eq(revisions.projectId, projectId)).all()
  const roundNumber = existingRevisions.length + 1
  await db.insert(revisions).values({
    id: generateId(),
    projectId,
    roundNumber,
    dateRequested: formData.get('dateRequested') as string,
    description: formData.get('description') as string,
    frameIoLink: formData.get('frameIoLink') as string || null,
    status: 'pending',
  })
  await db.insert(activityLog).values({
    id: generateId(),
    projectId,
    eventType: 'revision_logged',
    description: `Revision round ${roundNumber} logged`,
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function updateRevisionStatus(id: string, projectId: string, status: string) {
  await db.update(revisions).set({ status: status as any, updatedAt: new Date().toISOString() }).where(eq(revisions.id, id))
  revalidatePath(`/projects/${projectId}`)
}

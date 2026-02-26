import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { businessSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const destination = searchParams.get('destination')

  if (!destination) {
    return NextResponse.json({ error: 'destination required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 503 })
  }

  const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 'singleton')).get()
  const origin = settings?.baseLocation
  if (!origin) {
    return NextResponse.json({ error: 'Base location not set in Settings' }, { status: 400 })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=metric&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK') {
      console.error('[distance] Google Maps error:', data.status, data.error_message)
      return NextResponse.json({ error: 'Maps API error', details: data.status, message: data.error_message }, { status: 400 })
    }

    const element = data.rows?.[0]?.elements?.[0]
    if (element?.status !== 'OK') {
      return NextResponse.json({ error: 'Route not found' }, { status: 400 })
    }

    const distanceKm = element.distance.value / 1000 // metres to km
    return NextResponse.json({ distanceKm: Math.round(distanceKm * 10) / 10, text: element.distance.text })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch distance' }, { status: 500 })
  }
}

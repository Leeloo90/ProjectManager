import { NextResponse } from 'next/server'
import { updateEnvFile } from '@/lib/frameio/auth'

export async function POST() {
  updateEnvFile({
    FRAMEIO_ACCESS_TOKEN: '',
    FRAMEIO_REFRESH_TOKEN: '',
    FRAMEIO_ACCOUNT_ID: '',
  })
  return NextResponse.json({ ok: true })
}

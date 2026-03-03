import { NextRequest, NextResponse } from 'next/server'
import { getFrameioToken } from '@/lib/frameio/auth'

const BASE = 'https://api.frame.io/v4'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const folderId = formData.get('folderId') as string | null

  if (!file || !folderId) {
    return NextResponse.json({ error: 'file and folderId are required' }, { status: 400 })
  }

  const accountId = process.env.FRAMEIO_ACCOUNT_ID
  if (!accountId) {
    return NextResponse.json({ error: 'Frame.io not connected' }, { status: 401 })
  }

  try {
    const token = await getFrameioToken()

    // Step 1: create the asset slot in Frame.io to get upload credentials
    const createRes = await fetch(`${BASE}/accounts/${accountId}/folders/${folderId}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: file.name,
        filesize: file.size,
        filetype: file.type || 'video/mp4',
      }),
    })

    if (!createRes.ok) {
      const text = await createRes.text()
      return NextResponse.json(
        { error: `Failed to create Frame.io asset: ${createRes.status} ${text}` },
        { status: createRes.status },
      )
    }

    const createData = await createRes.json()
    const asset = createData.data ?? createData
    const assetId: string = asset.id
    const uploadUrls: string[] = asset.upload_urls ?? []

    if (!assetId || uploadUrls.length === 0) {
      return NextResponse.json(
        { error: 'Frame.io did not return upload credentials' },
        { status: 500 },
      )
    }

    // Step 2: upload the file binary to Frame.io's storage URL
    const buffer = await file.arrayBuffer()
    const uploadRes = await fetch(uploadUrls[0], {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: buffer,
    })

    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadRes.status}` },
        { status: uploadRes.status },
      )
    }

    return NextResponse.json({
      assetId,
      name: file.name,
      thumbnailUrl: null, // Frame.io generates this asynchronously after processing
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import fs from 'fs'
import path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env.local')
const TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3'

function updateEnvFile(updates: Record<string, string>) {
  let content = ''
  try {
    content = fs.readFileSync(ENV_PATH, 'utf-8')
  } catch {
    content = ''
  }

  const lines = content.split('\n')
  const updatedKeys = new Set<string>()

  const newLines = lines.map(line => {
    for (const [key, value] of Object.entries(updates)) {
      if (line.startsWith(`${key}=`) || line === key) {
        updatedKeys.add(key)
        return `${key}=${value}`
      }
    }
    return line
  })

  // Append any keys that weren't already in the file
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${value}`)
    }
  }

  fs.writeFileSync(ENV_PATH, newLines.join('\n'), 'utf-8')

  // Also update process.env so they're available in this process without restart
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value
  }
}

export async function refreshAccessToken(): Promise<string> {
  const clientId = process.env.FRAMEIO_CLIENT_ID
  const clientSecret = process.env.FRAMEIO_CLIENT_SECRET
  const refreshToken = process.env.FRAMEIO_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Frame.io credentials missing — cannot refresh token')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  const newAccessToken: string = data.access_token
  const updates: Record<string, string> = { FRAMEIO_ACCESS_TOKEN: newAccessToken }
  if (data.refresh_token) {
    updates.FRAMEIO_REFRESH_TOKEN = data.refresh_token
  }

  updateEnvFile(updates)
  return newAccessToken
}

/**
 * Returns a valid Frame.io access token.
 * Refreshes automatically if the current token is expired or missing.
 */
export async function getFrameioToken(): Promise<string> {
  const accessToken = process.env.FRAMEIO_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error('Frame.io not connected — FRAMEIO_ACCESS_TOKEN is not set')
  }

  // Test the token with a lightweight call
  const accountId = process.env.FRAMEIO_ACCOUNT_ID
  if (accountId) {
    const testRes = await fetch(`https://api.frame.io/v4/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (testRes.status === 401 || testRes.status === 403) {
      // Token expired or rejected — refresh
      return await refreshAccessToken()
    }

    if (testRes.ok) {
      return accessToken
    }
    // For other non-auth errors, try refreshing anyway to be safe
    try {
      return await refreshAccessToken()
    } catch {
      return accessToken
    }
  }

  return accessToken
}

export { updateEnvFile }

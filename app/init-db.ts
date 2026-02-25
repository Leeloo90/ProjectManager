import { initializeDatabase } from '@/lib/db/migrate'

let initialized = false

export function initDB() {
  if (!initialized) {
    try {
      initializeDatabase()
      initialized = true
    } catch (err) {
      console.error('DB initialization error:', err)
    }
  }
}

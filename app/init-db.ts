import { initializeDatabase } from '@/lib/db/migrate'

let initialized = false

export function initDB() {
  if (typeof window !== 'undefined') return
  if (!initialized) {
    try {
      initializeDatabase()
      initialized = true
    } catch (err) {
      console.error('DB initialization error:', err)
    }
  }
}

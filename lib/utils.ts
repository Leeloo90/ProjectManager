import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}

export const DURATION_BRACKETS = [
  { key: '5_10',    label: '5–10 seconds',  minSec: 5,   maxSec: 10  },
  { key: '15_20',   label: '15–20 seconds', minSec: 11,  maxSec: 20  },
  { key: '30_45',   label: '30–45 seconds', minSec: 21,  maxSec: 45  },
  { key: '60',      label: '60 seconds',    minSec: 46,  maxSec: 60  },
  { key: '90',      label: '90 seconds',    minSec: 61,  maxSec: 90  },
  { key: '120_180', label: '2–3 minutes',   minSec: 91,  maxSec: 180 },
  { key: '180_240', label: '3–4 minutes',   minSec: 181, maxSec: 240 },
  { key: '300_plus',label: '5+ minutes',    minSec: 241, maxSec: Infinity },
] as const

export type DurationBracketKey = typeof DURATION_BRACKETS[number]['key']

export function getDurationBracket(seconds: number): DurationBracketKey {
  for (const bracket of DURATION_BRACKETS) {
    if (seconds >= bracket.minSec && seconds <= bracket.maxSec) {
      return bracket.key
    }
  }
  return '300_plus'
}

export function getBracketLabel(key: string): string {
  return DURATION_BRACKETS.find(b => b.key === key)?.label ?? key
}

export const PROJECT_STATUSES = [
  { key: 'enquiry',        label: 'Enquiry',        colour: 'blue'   },
  { key: 'quoted',         label: 'Quoted',          colour: 'yellow' },
  { key: 'confirmed',      label: 'Confirmed',       colour: 'green'  },
  { key: 'in_production',  label: 'In Production',   colour: 'purple' },
  { key: 'in_post',        label: 'In Post',         colour: 'indigo' },
  { key: 'review',         label: 'Review',          colour: 'orange' },
  { key: 'revisions',      label: 'Revisions',       colour: 'pink'   },
  { key: 'final_delivery', label: 'Final Delivery',  colour: 'teal'   },
  { key: 'finished',       label: 'Finished',        colour: 'emerald'},
  { key: 'invoiced',       label: 'Invoiced',        colour: 'cyan'   },
  { key: 'paid',           label: 'Paid',            colour: 'gray'   },
  { key: 'cancelled',      label: 'Cancelled',       colour: 'red'    },
] as const

export type ProjectStatus = typeof PROJECT_STATUSES[number]['key']

export const ACTIVE_STATUSES: ProjectStatus[] = [
  'enquiry', 'quoted', 'confirmed', 'in_production', 'in_post', 'review', 'revisions', 'final_delivery',
]

export const INACTIVE_STATUSES: ProjectStatus[] = ['finished', 'invoiced', 'paid', 'cancelled']

export function getStatusConfig(key: string) {
  return PROJECT_STATUSES.find(s => s.key === key) ?? { key, label: key, colour: 'gray' }
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    enquiry:        'bg-blue-100 text-blue-800',
    quoted:         'bg-yellow-100 text-yellow-800',
    confirmed:      'bg-green-100 text-green-800',
    in_production:  'bg-purple-100 text-purple-800',
    in_post:        'bg-indigo-100 text-indigo-800',
    review:         'bg-orange-100 text-orange-800',
    revisions:      'bg-pink-100 text-pink-800',
    final_delivery: 'bg-teal-100 text-teal-800',
    finished:       'bg-emerald-100 text-emerald-800',
    invoiced:       'bg-cyan-100 text-cyan-800',
    paid:           'bg-gray-100 text-gray-700',
    cancelled:      'bg-red-100 text-red-700',
    // invoice statuses
    draft:          'bg-gray-100 text-gray-700',
    sent:           'bg-blue-100 text-blue-800',
    voided:         'bg-red-100 text-red-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

// Pricing config key builders
export function editPriceKey(type: 'basic' | 'advanced', bracket: string): string {
  const t = type === 'basic' ? 'basic' : 'advanced'
  return `edit_${t}_${bracket}`
}

export function colourGradingKey(level: 'standard' | 'advanced', bracket: string): string {
  return `colour_${level}_${bracket}`
}

export function subtitleKey(bracket: string): string {
  return `subtitles_basic_${bracket}`
}

export function shootRateKey(item: string, type: 'half' | 'full'): string {
  return `${item}_${type}`
}

// Generate invoice number
export function generateInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(3, '0')}`
}

// Financial year (March–Feb for South Africa)
export function getCurrentFinancialYear(): { start: Date; end: Date } {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-indexed
  const year = now.getFullYear()

  if (month >= 3) {
    return {
      start: new Date(year, 2, 1), // March 1
      end: new Date(year + 1, 1, 28), // Feb 28
    }
  } else {
    return {
      start: new Date(year - 1, 2, 1),
      end: new Date(year, 1, 28),
    }
  }
}

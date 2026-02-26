import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Production Companies ─────────────────────────────────────────────────────
export const productionCompanies = sqliteTable('production_companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  billingAddress: text('billing_address'),
  vatNumber: text('vat_number'),
  primaryContactName: text('primary_contact_name').notNull(),
  primaryContactEmail: text('primary_contact_email').notNull(),
  primaryContactPhone: text('primary_contact_phone'),
  secondaryContactName: text('secondary_contact_name'),
  secondaryContactEmail: text('secondary_contact_email'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Clients ──────────────────────────────────────────────────────────────────
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  productionCompanyId: text('production_company_id').notNull().references(() => productionCompanies.id),
  contactPerson: text('contact_person'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  productionCompanyId: text('production_company_id').notNull().references(() => productionCompanies.id),
  clientId: text('client_id').notNull().references(() => clients.id),
  startDate: text('start_date').notNull(),
  deadline: text('deadline').notNull(),
  status: text('status', {
    enum: ['enquiry', 'quoted', 'confirmed', 'in_production', 'in_post', 'review', 'revisions', 'final_delivery', 'finished', 'invoiced', 'paid', 'cancelled'],
  }).notNull().default('enquiry'),
  includedRevisionRounds: integer('included_revision_rounds').default(2),
  frameIoLink: text('frame_io_link'),
  drivefinalsLink: text('drive_finals_link'),
  driveArchiveLink: text('drive_archive_link'),
  notes: text('notes'),
  invoiceId: text('invoice_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Deliverables ─────────────────────────────────────────────────────────────
export const deliverables = sqliteTable('deliverables', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  videoLengthSeconds: integer('video_length_seconds').notNull(),
  durationBracket: text('duration_bracket', {
    enum: ['5_10', '15_20', '30_45', '60', '90', '120_180', '180_240', '300_plus'],
  }).notNull(),
  primaryFormat: text('primary_format', {
    enum: ['landscape', 'portrait', 'square'],
  }).notNull(),
  editType: text('edit_type', {
    enum: ['basic', 'advanced', 'colour_only'],
  }).notNull(),
  colourGrading: text('colour_grading', {
    enum: ['none', 'standard', 'advanced'],
  }).default('none'),
  subtitles: text('subtitles', {
    enum: ['none', 'basic', 'styled'],
  }).default('none'),
  additionalFormats: integer('additional_formats').default(0),
  hasCustomMusic: integer('has_custom_music', { mode: 'boolean' }).default(false),
  customMusicCost: real('custom_music_cost'),
  hasCustomGraphics: integer('has_custom_graphics', { mode: 'boolean' }).default(false),
  customGraphicsDescription: text('custom_graphics_description'),
  customGraphicsCost: real('custom_graphics_cost'),
  rushFeeType: text('rush_fee_type', {
    enum: ['none', 'standard', 'emergency'],
  }).default('none'),
  calculatedCost: real('calculated_cost').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Shoot Details ────────────────────────────────────────────────────────────
export const shootDetails = sqliteTable('shoot_details', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  shootType: text('shoot_type', { enum: ['half_day', 'full_day'] }).notNull(),
  cameraBody: text('camera_body', { enum: ['a7siii', 'a7iii'] }).notNull(),
  hasSecondShooter: integer('has_second_shooter', { mode: 'boolean' }).default(false),
  secondShooterType: text('second_shooter_type', { enum: ['half_day', 'full_day'] }),
  hasSoundKit: integer('has_sound_kit', { mode: 'boolean' }).default(false),
  soundKitType: text('sound_kit_type', { enum: ['half_day', 'full_day'] }),
  hasLighting: integer('has_lighting', { mode: 'boolean' }).default(false),
  lightingType: text('lighting_type', { enum: ['half_day', 'full_day'] }),
  hasGimbal: integer('has_gimbal', { mode: 'boolean' }).default(false),
  gimbalType: text('gimbal_type', { enum: ['half_day', 'full_day'] }),
  additionalEquipment: text('additional_equipment'), // JSON array of {name, cost}
  travelMethod: text('travel_method', { enum: ['none', 'driving', 'flying'] }).default('none'),
  shootLocation: text('shoot_location'),
  distanceKm: real('distance_km'),
  airfareCost: real('airfare_cost'),
  accommodationNights: integer('accommodation_nights'),
  accommodationPerNight: real('accommodation_per_night'),
  calculatedShootCost: real('calculated_shoot_cost').notNull().default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Revisions ────────────────────────────────────────────────────────────────
export const revisions = sqliteTable('revisions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  dateRequested: text('date_requested').notNull(),
  description: text('description').notNull(),
  frameIoLink: text('frame_io_link'),
  status: text('status', { enum: ['pending', 'in_progress', 'complete'] }).default('pending'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  productionCompanyId: text('production_company_id').notNull().references(() => productionCompanies.id),
  invoiceDate: text('invoice_date').notNull(),
  dueDate: text('due_date').notNull(),
  poReference: text('po_reference'),
  status: text('status', { enum: ['draft', 'sent', 'paid', 'voided'] }).default('sent'),
  subtotal: real('subtotal').notNull(),
  vatAmount: real('vat_amount').notNull().default(0),
  total: real('total').notNull(),
  paymentDate: text('payment_date'),
  paymentMethod: text('payment_method'),
  paymentReference: text('payment_reference'),
  lineItemOverrides: text('line_item_overrides'),
  discountType: text('discount_type', { enum: ['none', 'percentage', 'fixed'] }).default('none'),
  discountValue: real('discount_value').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Activity Log ─────────────────────────────────────────────────────────────
export const activityLog = sqliteTable('activity_log', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  invoiceId: text('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(), // e.g. 'project_created', 'status_changed', 'invoice_sent', etc.
  description: text('description').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// ─── Pricing Config ───────────────────────────────────────────────────────────
export const pricingConfig = sqliteTable('pricing_config', {
  id: text('id').primaryKey(),
  configKey: text('config_key').notNull().unique(),
  configValue: real('config_value').notNull(),
  label: text('label').notNull(),
  category: text('category').notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Business Settings ────────────────────────────────────────────────────────
export const businessSettings = sqliteTable('business_settings', {
  id: text('id').primaryKey().default('singleton'),
  businessName: text('business_name').notNull().default('Ambient Arts'),
  businessAddress: text('business_address'),
  vatNumber: text('vat_number'),
  businessRegistrationNumber: text('business_registration_number'),
  bankingDetails: text('banking_details'), // JSON or freeform text
  invoicePrefix: text('invoice_prefix').default('AA'),
  invoiceStartingNumber: integer('invoice_starting_number').default(1),
  vatRate: real('vat_rate').default(15),
  includeVat: integer('include_vat', { mode: 'boolean' }).default(true),
  baseLocation: text('base_location'),
  overnightDistanceThreshold: real('overnight_distance_threshold').default(200),
  perKmTravelRate: real('per_km_travel_rate').default(5),
  logoUrl: text('logo_url'),
  defaultRevisionRounds: integer('default_revision_rounds').default(2),
  paymentTermsText: text('payment_terms_text').default('Payment due within 30 days of invoice date'),
  gmailRefreshToken: text('gmail_refresh_token'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

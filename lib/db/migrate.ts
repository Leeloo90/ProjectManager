import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'ambient-arts.db')

export function initializeDatabase() {
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  // Create all tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS production_companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      billing_address TEXT,
      vat_number TEXT,
      primary_contact_name TEXT NOT NULL,
      primary_contact_email TEXT NOT NULL,
      primary_contact_phone TEXT,
      secondary_contact_name TEXT,
      secondary_contact_email TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      production_company_id TEXT NOT NULL REFERENCES production_companies(id),
      contact_person TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      production_company_id TEXT NOT NULL REFERENCES production_companies(id),
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      po_reference TEXT,
      status TEXT DEFAULT 'sent',
      subtotal REAL NOT NULL,
      vat_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_date TEXT,
      payment_method TEXT,
      payment_reference TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      production_company_id TEXT NOT NULL REFERENCES production_companies(id),
      client_id TEXT NOT NULL REFERENCES clients(id),
      start_date TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'enquiry',
      included_revision_rounds INTEGER DEFAULT 2,
      frame_io_link TEXT,
      drive_finals_link TEXT,
      drive_archive_link TEXT,
      notes TEXT,
      invoice_id TEXT REFERENCES invoices(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      video_length_seconds INTEGER NOT NULL,
      duration_bracket TEXT NOT NULL,
      primary_format TEXT NOT NULL,
      edit_type TEXT NOT NULL,
      colour_grading TEXT DEFAULT 'none',
      subtitles TEXT DEFAULT 'none',
      additional_formats INTEGER DEFAULT 0,
      has_custom_music INTEGER DEFAULT 0,
      custom_music_cost REAL,
      has_custom_graphics INTEGER DEFAULT 0,
      custom_graphics_description TEXT,
      custom_graphics_cost REAL,
      rush_fee_type TEXT DEFAULT 'none',
      calculated_cost REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shoot_details (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      shoot_type TEXT NOT NULL,
      camera_body TEXT NOT NULL,
      has_second_shooter INTEGER DEFAULT 0,
      second_shooter_type TEXT,
      has_sound_kit INTEGER DEFAULT 0,
      sound_kit_type TEXT,
      has_lighting INTEGER DEFAULT 0,
      lighting_type TEXT,
      has_gimbal INTEGER DEFAULT 0,
      gimbal_type TEXT,
      additional_equipment TEXT,
      travel_method TEXT DEFAULT 'none',
      shoot_location TEXT,
      distance_km REAL,
      airfare_cost REAL,
      accommodation_nights INTEGER,
      accommodation_per_night REAL,
      calculated_shoot_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      date_requested TEXT NOT NULL,
      description TEXT NOT NULL,
      frame_io_link TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pricing_config (
      id TEXT PRIMARY KEY,
      config_key TEXT NOT NULL UNIQUE,
      config_value REAL NOT NULL,
      label TEXT NOT NULL,
      category TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS business_settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      business_name TEXT NOT NULL DEFAULT 'Ambient Arts',
      business_address TEXT,
      vat_number TEXT,
      banking_details TEXT,
      invoice_prefix TEXT DEFAULT 'AA',
      invoice_starting_number INTEGER DEFAULT 1,
      vat_rate REAL DEFAULT 15,
      include_vat INTEGER DEFAULT 1,
      base_location TEXT,
      overnight_distance_threshold REAL DEFAULT 200,
      per_km_travel_rate REAL DEFAULT 5,
      logo_url TEXT,
      default_revision_rounds INTEGER DEFAULT 2,
      payment_terms_text TEXT DEFAULT 'Payment due within 30 days of invoice date',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Add new columns that may not exist on older DBs
  try { sqlite.exec(`ALTER TABLE business_settings ADD COLUMN business_registration_number TEXT`) } catch {}
  try { sqlite.exec(`ALTER TABLE invoices ADD COLUMN line_item_overrides TEXT`) } catch {}

  // Seed business settings if not exists
  const settings = sqlite.prepare('SELECT id FROM business_settings WHERE id = ?').get('singleton')
  if (!settings) {
    sqlite.prepare(`INSERT INTO business_settings (id) VALUES ('singleton')`).run()
  }

  // Seed pricing config defaults
  const existingPricing = sqlite.prepare('SELECT COUNT(*) as count FROM pricing_config').get() as { count: number }
  if (existingPricing.count === 0) {
    const insertConfig = sqlite.prepare(`
      INSERT INTO pricing_config (id, config_key, config_value, label, category)
      VALUES (?, ?, ?, ?, ?)
    `)

    const configs = [
      // Edit Pricing — Basic Edit (per bracket)
      ['pc_eb_5_10',    'edit_basic_5_10',    800,   '5–10sec Basic Edit',    'edit_pricing'],
      ['pc_eb_15_20',   'edit_basic_15_20',   1000,  '15–20sec Basic Edit',   'edit_pricing'],
      ['pc_eb_30_45',   'edit_basic_30_45',   1500,  '30–45sec Basic Edit',   'edit_pricing'],
      ['pc_eb_60',      'edit_basic_60',       2000,  '60sec Basic Edit',      'edit_pricing'],
      ['pc_eb_90',      'edit_basic_90',       2500,  '90sec Basic Edit',      'edit_pricing'],
      ['pc_eb_120_180', 'edit_basic_120_180',  3500,  '2–3min Basic Edit',     'edit_pricing'],
      ['pc_eb_180_240', 'edit_basic_180_240',  4500,  '3–4min Basic Edit',     'edit_pricing'],
      ['pc_eb_300',     'edit_basic_300_plus', 6000,  '5min+ Basic Edit',      'edit_pricing'],
      // Edit Pricing — Advanced Edit (per bracket)
      ['pc_ea_5_10',    'edit_advanced_5_10',    1200,  '5–10sec Advanced Edit',    'edit_pricing'],
      ['pc_ea_15_20',   'edit_advanced_15_20',   1600,  '15–20sec Advanced Edit',   'edit_pricing'],
      ['pc_ea_30_45',   'edit_advanced_30_45',   2400,  '30–45sec Advanced Edit',   'edit_pricing'],
      ['pc_ea_60',      'edit_advanced_60',       2800,  '60sec Advanced Edit',      'edit_pricing'],
      ['pc_ea_90',      'edit_advanced_90',       3800,  '90sec Advanced Edit',      'edit_pricing'],
      ['pc_ea_120_180', 'edit_advanced_120_180',  5200,  '2–3min Advanced Edit',     'edit_pricing'],
      ['pc_ea_180_240', 'edit_advanced_180_240',  7000,  '3–4min Advanced Edit',     'edit_pricing'],
      ['pc_ea_300',     'edit_advanced_300_plus', 9500,  '5min+ Advanced Edit',      'edit_pricing'],
      // Colour Grading — Standard
      ['pc_cgs_5_10',    'colour_standard_5_10',    400,  '5–10sec Colour Standard',    'colour_grading'],
      ['pc_cgs_15_20',   'colour_standard_15_20',   500,  '15–20sec Colour Standard',   'colour_grading'],
      ['pc_cgs_30_45',   'colour_standard_30_45',   700,  '30–45sec Colour Standard',   'colour_grading'],
      ['pc_cgs_60',      'colour_standard_60',       900,  '60sec Colour Standard',      'colour_grading'],
      ['pc_cgs_90',      'colour_standard_90',       1100, '90sec Colour Standard',      'colour_grading'],
      ['pc_cgs_120_180', 'colour_standard_120_180',  1500, '2–3min Colour Standard',     'colour_grading'],
      ['pc_cgs_180_240', 'colour_standard_180_240',  2000, '3–4min Colour Standard',     'colour_grading'],
      ['pc_cgs_300',     'colour_standard_300_plus', 2800, '5min+ Colour Standard',      'colour_grading'],
      // Colour Grading — Advanced
      ['pc_cga_5_10',    'colour_advanced_5_10',    600,  '5–10sec Colour Advanced',    'colour_grading'],
      ['pc_cga_15_20',   'colour_advanced_15_20',   800,  '15–20sec Colour Advanced',   'colour_grading'],
      ['pc_cga_30_45',   'colour_advanced_30_45',   1100, '30–45sec Colour Advanced',   'colour_grading'],
      ['pc_cga_60',      'colour_advanced_60',       1400, '60sec Colour Advanced',      'colour_grading'],
      ['pc_cga_90',      'colour_advanced_90',       1800, '90sec Colour Advanced',      'colour_grading'],
      ['pc_cga_120_180', 'colour_advanced_120_180',  2400, '2–3min Colour Advanced',     'colour_grading'],
      ['pc_cga_180_240', 'colour_advanced_180_240',  3200, '3–4min Colour Advanced',     'colour_grading'],
      ['pc_cga_300',     'colour_advanced_300_plus', 4500, '5min+ Colour Advanced',      'colour_grading'],
      // Subtitles — Basic
      ['pc_sb_5_10',    'subtitles_basic_5_10',    200,  '5–10sec Subtitles Basic',    'subtitles'],
      ['pc_sb_15_20',   'subtitles_basic_15_20',   250,  '15–20sec Subtitles Basic',   'subtitles'],
      ['pc_sb_30_45',   'subtitles_basic_30_45',   350,  '30–45sec Subtitles Basic',   'subtitles'],
      ['pc_sb_60',      'subtitles_basic_60',       450,  '60sec Subtitles Basic',      'subtitles'],
      ['pc_sb_90',      'subtitles_basic_90',       550,  '90sec Subtitles Basic',      'subtitles'],
      ['pc_sb_120_180', 'subtitles_basic_120_180',  750,  '2–3min Subtitles Basic',     'subtitles'],
      ['pc_sb_180_240', 'subtitles_basic_180_240',  950,  '3–4min Subtitles Basic',     'subtitles'],
      ['pc_sb_300',     'subtitles_basic_300_plus', 1200, '5min+ Subtitles Basic',      'subtitles'],
      // Styled Subtitles Multiplier
      ['pc_styled_sub_mult', 'styled_subtitles_multiplier', 2.0, 'Styled Subtitles Multiplier', 'addon_rates'],
      // Multi-format additional rate
      ['pc_multiformat_rate', 'multiformat_additional_rate', 0.20, 'Multi-Format Additional Rate (%)', 'addon_rates'],
      // Rush fees
      ['pc_rush_standard',  'rush_standard',  0.25, 'Rush Fee — Standard (%)',   'addon_rates'],
      ['pc_rush_emergency', 'rush_emergency', 0.50, 'Rush Fee — Emergency (%)',  'addon_rates'],
      // Additional revision rate
      ['pc_extra_revision', 'additional_revision_rate', 0.15, 'Additional Revision Rate (% of base)', 'addon_rates'],
      // Shoot Day Rates
      ['pc_shoot_half',   'shoot_day_half',   3000, 'Shoot Day Rate — Half Day', 'shoot_rates'],
      ['pc_shoot_full',   'shoot_day_full',   5000, 'Shoot Day Rate — Full Day', 'shoot_rates'],
      // Second Shooter Rates
      ['pc_shooter2_half', 'second_shooter_half', 1500, 'Second Shooter — Half Day', 'shoot_rates'],
      ['pc_shooter2_full', 'second_shooter_full', 2500, 'Second Shooter — Full Day', 'shoot_rates'],
      // Camera Hire
      ['pc_a7siii_half', 'camera_a7siii_half', 800, 'Sony a7SIII Hire — Half Day', 'shoot_rates'],
      ['pc_a7siii_full', 'camera_a7siii_full', 1400, 'Sony a7SIII Hire — Full Day', 'shoot_rates'],
      ['pc_a7iii_half',  'camera_a7iii_half',  500, 'Sony a7III Hire — Half Day',  'shoot_rates'],
      ['pc_a7iii_full',  'camera_a7iii_full',  900, 'Sony a7III Hire — Full Day',  'shoot_rates'],
      // Sound Kit
      ['pc_sound_half', 'sound_kit_half', 400, 'Sound Kit — Half Day', 'shoot_rates'],
      ['pc_sound_full', 'sound_kit_full', 700, 'Sound Kit — Full Day', 'shoot_rates'],
      // Lighting Kit
      ['pc_lighting_half', 'lighting_half', 500, 'Lighting Kit — Half Day', 'shoot_rates'],
      ['pc_lighting_full', 'lighting_full', 900, 'Lighting Kit — Full Day', 'shoot_rates'],
      // Gimbal
      ['pc_gimbal_half', 'gimbal_half', 300, 'Gimbal/Stabiliser — Half Day', 'shoot_rates'],
      ['pc_gimbal_full', 'gimbal_full', 500, 'Gimbal/Stabiliser — Full Day', 'shoot_rates'],
    ]

    const insertMany = sqlite.transaction((items: (string | number)[][]) => {
      for (const [id, key, value, label, category] of items) {
        insertConfig.run(id, key, value, label, category)
      }
    })
    insertMany(configs)
  }

  sqlite.close()
}

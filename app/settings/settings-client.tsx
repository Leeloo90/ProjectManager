'use client'
import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { updateBusinessSettings, updateAllPricing } from './actions'
import { useRouter } from 'next/navigation'
import { DURATION_BRACKETS } from '@/lib/utils'
import { Save, Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete'

type PricingConfig = { id: string; configKey: string; configValue: number; label: string; category: string }

const BRACKET_LABELS: Record<string, string> = {
  '5_10': '5–10s', '15_20': '15–20s', '30_45': '30–45s', '60': '60s',
  '90': '90s', '120_180': '2–3m', '180_240': '3–4m', '300_plus': '5m+'
}

function PricingGrid({ title, rows, cols, pricingValues, onUpdate }: {
  title: string
  rows: string[]
  cols: { key: string; label: string }[]
  pricingValues: Record<string, number>
  onUpdate: (key: string, value: number) => void
}) {
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Bracket</th>
              {cols.map(col => (
                <th key={col.key} className="px-3 py-2 text-gray-500 font-medium text-right">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(bracket => (
              <tr key={bracket} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600 font-medium">{BRACKET_LABELS[bracket] ?? bracket}</td>
                {cols.map(col => {
                  const key = `${col.key}_${bracket}`
                  return (
                    <td key={col.key} className="px-3 py-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={pricingValues[key] ?? 0}
                        onChange={e => onUpdate(key, parseFloat(e.target.value) || 0)}
                        className="h-8 text-right"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SettingsClient({ settings: initialSettings, pricing: initialPricing, isGmailConnected, gmailStatus }: {
  settings: any
  pricing: PricingConfig[]
  isGmailConnected: boolean
  gmailStatus: string | null
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pricingPending, startPricingTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'business' | 'pricing' | 'addons' | 'shoot' | 'integrations'>(
    gmailStatus ? 'integrations' : 'business'
  )
  const [baseLocationMap, setBaseLocationMap] = useState<string>(initialSettings?.baseLocation ?? '')
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    if (gmailStatus === 'connected') {
      toast('Gmail connected successfully')
    } else if (gmailStatus === 'error') {
      toast('Gmail connection failed — please try again', 'error')
    }
  }, [])

  // Build mutable pricing map
  const [pricingValues, setPricingValues] = useState<Record<string, number>>(
    Object.fromEntries(initialPricing.map(p => [p.configKey, p.configValue]))
  )

  function handlePricingUpdate(key: string, value: number) {
    setPricingValues(prev => ({ ...prev, [key]: value }))
  }

  function handleSavePricing() {
    startPricingTransition(async () => {
      await updateAllPricing(pricingValues)
      toast('Pricing saved')
      router.refresh()
    })
  }

  function handleSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateBusinessSettings(fd)
      toast('Settings saved')
      router.refresh()
    })
  }

  const brackets = DURATION_BRACKETS.map(b => b.key)

  async function handleDisconnectGmail() {
    setDisconnecting(true)
    try {
      await fetch('/api/gmail/disconnect', { method: 'POST' })
      toast('Gmail disconnected')
      router.refresh()
    } finally {
      setDisconnecting(false)
    }
  }

  const tabs = [
    { key: 'business', label: 'Business Settings' },
    { key: 'pricing', label: 'Edit Pricing' },
    { key: 'addons', label: 'Add-On Rates' },
    { key: 'shoot', label: 'Shoot & Gear Rates' },
    { key: 'integrations', label: 'Integrations' },
  ] as const

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Tab nav */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white overflow-hidden mb-6 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-[#1e3a5f] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Business Settings */}
      {activeTab === 'business' && (
        <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-6">
          <Card>
            <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Business Name *</Label>
                <Input name="businessName" defaultValue={initialSettings?.businessName ?? 'Ambient Arts'} required />
              </div>
              <div>
                <Label>Business Address</Label>
                <Textarea name="businessAddress" defaultValue={initialSettings?.businessAddress ?? ''} rows={3} />
              </div>
              <div>
                <Label>VAT Number</Label>
                <Input name="vatNumber" defaultValue={initialSettings?.vatNumber ?? ''} />
              </div>
              <div>
                <Label>Business Registration Number</Label>
                <Input name="businessRegistrationNumber" defaultValue={initialSettings?.businessRegistrationNumber ?? ''} placeholder="e.g. 2023/123456/07" />
              </div>
              <div>
                <Label>Banking Details</Label>
                <Textarea name="bankingDetails" defaultValue={initialSettings?.bankingDetails ?? ''} rows={3} placeholder="Bank name, account number, branch code, account type" />
              </div>
              <div>
                <Label>Payment Terms Text</Label>
                <Input name="paymentTermsText" defaultValue={initialSettings?.paymentTermsText ?? 'Payment due within 30 days of invoice date'} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Invoice Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Number Prefix</Label>
                  <Input name="invoicePrefix" defaultValue={initialSettings?.invoicePrefix ?? 'AA'} maxLength={10} />
                  <p className="text-xs text-gray-400 mt-1">e.g. AA → AA-2026-001</p>
                </div>
                <div>
                  <Label>Starting Number</Label>
                  <Input name="invoiceStartingNumber" type="number" min="1" defaultValue={initialSettings?.invoiceStartingNumber ?? 1} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>VAT Rate (%)</Label>
                  <Input name="vatRate" type="number" min="0" max="100" step="0.1" defaultValue={initialSettings?.vatRate ?? 15} />
                </div>
                <div>
                  <Label>Include VAT on Invoices</Label>
                  <select name="includeVat" defaultValue={initialSettings?.includeVat ? 'true' : 'false'}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                    <option value="true">Yes — include VAT</option>
                    <option value="false">No — VAT not applicable</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Travel & Revision Defaults</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Base Location (for travel calculation)</Label>
                <PlacesAutocomplete
                  name="baseLocation"
                  defaultValue={initialSettings?.baseLocation ?? ''}
                  placeholder="e.g. Johannesburg, Gauteng"
                  onSelect={addr => setBaseLocationMap(addr)}
                />
                {baseLocationMap && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(baseLocationMap)}&zoom=13&size=600x160&markers=color:0x1e3a5f|${encodeURIComponent(baseLocationMap)}&scale=2&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                      alt="Base location map"
                      className="w-full"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Overnight Distance Threshold (km)</Label>
                  <Input name="overnightDistanceThreshold" type="number" min="0" defaultValue={initialSettings?.overnightDistanceThreshold ?? 200} />
                </div>
                <div>
                  <Label>Per-km Travel Rate (ZAR)</Label>
                  <Input name="perKmTravelRate" type="number" min="0" step="0.1" defaultValue={initialSettings?.perKmTravelRate ?? 5} />
                </div>
              </div>
              <div>
                <Label>Default Included Revision Rounds</Label>
                <Input name="defaultRevisionRounds" type="number" min="0" defaultValue={initialSettings?.defaultRevisionRounds ?? 2} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={pending} size="lg">
            <Save size={16} /> {pending ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      )}

      {/* Edit Pricing */}
      {activeTab === 'pricing' && (
        <div className="max-w-3xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Type Pricing (ZAR)</CardTitle>
                <Button onClick={handleSavePricing} disabled={pricingPending}>
                  <Save size={15} /> {pricingPending ? 'Saving...' : 'Save Pricing'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PricingGrid
                title="Basic Edit & Advanced Edit"
                rows={brackets}
                cols={[
                  { key: 'edit_basic', label: 'Basic Edit' },
                  { key: 'edit_advanced', label: 'Advanced Edit' },
                ]}
                pricingValues={pricingValues}
                onUpdate={handlePricingUpdate}
              />

              <PricingGrid
                title="Colour Grading"
                rows={brackets}
                cols={[
                  { key: 'colour_standard', label: 'Standard' },
                  { key: 'colour_advanced', label: 'Advanced' },
                ]}
                pricingValues={pricingValues}
                onUpdate={handlePricingUpdate}
              />

              <PricingGrid
                title="Subtitles — Basic (Styled is 2× Basic)"
                rows={brackets}
                cols={[{ key: 'subtitles_basic', label: 'Basic Subtitles' }]}
                pricingValues={pricingValues}
                onUpdate={handlePricingUpdate}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add-On Rates */}
      {activeTab === 'addons' && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add-On Rates</CardTitle>
                <Button onClick={handleSavePricing} disabled={pricingPending}>
                  <Save size={15} /> {pricingPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-400 mb-4">Percentage values are decimals (e.g. 0.20 = 20%, 0.25 = 25%)</p>
              <div className="space-y-4">
                {[
                  { key: 'multiformat_additional_rate', label: 'Multi-Format Additional Rate', hint: 'Per extra format as % of base edit price. Default: 0.20' },
                  { key: 'styled_subtitles_multiplier', label: 'Styled Subtitles Multiplier', hint: 'Multiplied against Basic Subtitles price. Default: 2.0' },
                  { key: 'rush_standard', label: 'Rush Fee — Standard', hint: 'Surcharge % on total edit cost. Default: 0.25' },
                  { key: 'rush_emergency', label: 'Rush Fee — Emergency', hint: 'Surcharge % on total edit cost. Default: 0.50' },
                  { key: 'additional_revision_rate', label: 'Additional Revision Rate', hint: '% of base edit price per extra revision round. Default: 0.15' },
                ].map(item => (
                  <div key={item.key}>
                    <Label>{item.label}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingValues[item.key] ?? 0}
                      onChange={e => handlePricingUpdate(item.key, parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-gray-400 mt-1">{item.hint}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Integrations */}
      {activeTab === 'integrations' && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail size={18} />Gmail Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Connect your Gmail account to view labeled email correspondence directly inside each project.
                Emails labeled with the project name will appear on the project's Emails page.
              </p>

              {isGmailConnected ? (
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle size={18} />
                    <span className="font-medium text-sm">Gmail connected</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectGmail}
                    disabled={disconnecting}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {disconnecting ? <><Loader2 size={14} className="animate-spin" /> Disconnecting...</> : 'Disconnect'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-500">
                    <XCircle size={18} />
                    <span className="text-sm">Not connected</span>
                  </div>
                  <a href="/api/gmail/auth">
                    <Button size="sm">
                      <Mail size={14} /> Connect Gmail
                    </Button>
                  </a>
                </div>
              )}

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Setup requirements</p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li>Add <code className="bg-white border border-gray-200 rounded px-1">GMAIL_CLIENT_ID</code> and <code className="bg-white border border-gray-200 rounded px-1">GMAIL_CLIENT_SECRET</code> to your <code className="bg-white border border-gray-200 rounded px-1">.env.local</code></li>
                  <li>Add <code className="bg-white border border-gray-200 rounded px-1">http://localhost:3000/api/gmail/callback</code> as an authorized redirect URI in Google Cloud Console</li>
                  <li>Label emails in Gmail with the exact project name to have them appear on the project's Emails page</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shoot & Gear Rates */}
      {activeTab === 'shoot' && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Shoot & Gear Rates (ZAR)</CardTitle>
                <Button onClick={handleSavePricing} disabled={pricingPending}>
                  <Save size={15} /> {pricingPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 rounded">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Item</th>
                    <th className="px-3 py-2 text-gray-500 font-medium text-right">Half Day</th>
                    <th className="px-3 py-2 text-gray-500 font-medium text-right">Full Day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { key: 'shoot_day', label: 'Shoot Day Rate (own rate)' },
                    { key: 'second_shooter', label: 'Second Shooter Rate' },
                    { key: 'camera_a7siii', label: 'Sony a7SIII Hire' },
                    { key: 'camera_a7iii', label: 'Sony a7III Hire' },
                    { key: 'sound_kit', label: 'Sound Kit Hire' },
                    { key: 'lighting', label: 'Professional Lighting Kit Hire' },
                    { key: 'gimbal', label: 'Gimbal / Stabiliser Hire' },
                  ].map(item => (
                    <tr key={item.key}>
                      <td className="px-3 py-2 text-gray-700">{item.label}</td>
                      <td className="px-3 py-1">
                        <Input
                          type="number" min="0" step="1"
                          value={pricingValues[`${item.key}_half`] ?? 0}
                          onChange={e => handlePricingUpdate(`${item.key}_half`, parseFloat(e.target.value) || 0)}
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="px-3 py-1">
                        <Input
                          type="number" min="0" step="1"
                          value={pricingValues[`${item.key}_full`] ?? 0}
                          onChange={e => handlePricingUpdate(`${item.key}_full`, parseFloat(e.target.value) || 0)}
                          className="h-8 text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

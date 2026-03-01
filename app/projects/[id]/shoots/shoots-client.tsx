'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { saveShootDetails, deleteShootDetails } from '../../actions'
import { Edit, Trash2, Plus, MapPin, Loader2 } from 'lucide-react'
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete'
import { useRouter } from 'next/navigation'

type Shoot = {
  id: string; projectId: string; shootDate: string | null; shootLabel: string | null;
  shootType: string; cameraBody: string;
  hasSecondShooter: boolean | null; secondShooterType: string | null;
  hasSoundKit: boolean | null; soundKitType: string | null;
  hasLighting: boolean | null; lightingType: string | null;
  hasGimbal: boolean | null; gimbalType: string | null;
  additionalEquipment: string | null; travelMethod: string | null;
  shootLocation: string | null; distanceKm: number | null; airfareCost: number | null;
  accommodationNights: number | null; accommodationPerNight: number | null;
  calculatedShootCost: number;
}

// ─── Shoot Form ───────────────────────────────────────────────────────────────
function ShootForm({ shoot, settings, onSave, onClose }: {
  shoot?: Shoot | null; settings: any; onSave: (fd: FormData) => void; onClose: () => void
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [travelMethod, setTravelMethod] = useState(shoot?.travelMethod ?? 'none')
  const [hasSecondShooter, setHasSecondShooter] = useState(!!shoot?.hasSecondShooter)
  const [hasSoundKit, setHasSoundKit] = useState(!!shoot?.hasSoundKit)
  const [hasLighting, setHasLighting] = useState(!!shoot?.hasLighting)
  const [hasGimbal, setHasGimbal] = useState(!!shoot?.hasGimbal)
  const [extraEquipment, setExtraEquipment] = useState<{ name: string; cost: string }[]>(
    shoot?.additionalEquipment ? JSON.parse(shoot.additionalEquipment) : []
  )
  const [locationAddress, setLocationAddress] = useState(shoot?.shootLocation ?? '')
  const [distanceKm, setDistanceKm] = useState(shoot?.distanceKm?.toString() ?? '')
  const [calculatingDistance, setCalculatingDistance] = useState(false)

  async function handleCalculateDistance() {
    if (!locationAddress.trim()) return
    setCalculatingDistance(true)
    try {
      const res = await fetch(`/api/maps/distance?destination=${encodeURIComponent(locationAddress)}`)
      const data = await res.json()
      if (data.distanceKm) {
        setDistanceKm(String(Math.ceil(data.distanceKm)))
        toast(`Distance: ${data.text ?? data.distanceKm + ' km'}`)
      } else {
        const msg = data.details ? `${data.error}: ${data.details}` : (data.error ?? 'Could not calculate distance')
        toast(msg, 'error')
      }
    } catch {
      toast('Could not reach the distance API', 'error')
    }
    setCalculatingDistance(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('hasSecondShooter', hasSecondShooter.toString())
    fd.set('hasSoundKit', hasSoundKit.toString())
    fd.set('hasLighting', hasLighting.toString())
    fd.set('hasGimbal', hasGimbal.toString())
    fd.set('additionalEquipment', JSON.stringify(extraEquipment))
    fd.set('travelMethod', travelMethod)
    startTransition(() => onSave(fd))
  }

  const dayTypeSelect = (name: string, defaultVal?: string | null) => (
    <Select name={name} defaultValue={defaultVal ?? 'half_day'}>
      <option value="half_day">Half Day</option>
      <option value="full_day">Full Day</option>
    </Select>
  )

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {/* Label & Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Shoot Label</Label>
          <Input name="shootLabel" defaultValue={shoot?.shootLabel ?? ''} placeholder='e.g. "Day 1 – Studio"' />
        </div>
        <div>
          <Label>Shoot Date</Label>
          <Input name="shootDate" type="date" defaultValue={shoot?.shootDate ?? ''} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Shoot Type *</Label>
          <Select name="shootType" defaultValue={shoot?.shootType ?? 'full_day'} required>
            <option value="half_day">Half Day</option>
            <option value="full_day">Full Day</option>
          </Select>
        </div>
        <div>
          <Label>Camera Body *</Label>
          <Select name="cameraBody" defaultValue={shoot?.cameraBody ?? 'a7siii'} required>
            <option value="a7siii">Sony a7SIII</option>
            <option value="a7iii">Sony a7III</option>
          </Select>
        </div>
      </div>

      {[
        { key: 'secondShooter', label: 'Second Shooter', has: hasSecondShooter, setHas: setHasSecondShooter, typeField: 'secondShooterType', typeVal: shoot?.secondShooterType },
        { key: 'soundKit', label: 'Sound Kit', has: hasSoundKit, setHas: setHasSoundKit, typeField: 'soundKitType', typeVal: shoot?.soundKitType },
        { key: 'lighting', label: 'Professional Lighting Kit', has: hasLighting, setHas: setHasLighting, typeField: 'lightingType', typeVal: shoot?.lightingType },
        { key: 'gimbal', label: 'Gimbal / Stabiliser', has: hasGimbal, setHas: setHasGimbal, typeField: 'gimbalType', typeVal: shoot?.gimbalType },
      ].map(item => (
        <div key={item.key} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
          <input type="checkbox" id={item.key} checked={item.has} onChange={e => item.setHas(e.target.checked)} className="mt-1" />
          <div className="flex-1">
            <label htmlFor={item.key} className="text-sm font-medium text-gray-700 cursor-pointer">{item.label}</label>
            {item.has && <div className="mt-2">{dayTypeSelect(item.typeField, item.typeVal)}</div>}
          </div>
        </div>
      ))}

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="mb-0">Additional Equipment</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setExtraEquipment(prev => [...prev, { name: '', cost: '' }])}>
            <Plus size={13} /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {extraEquipment.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Item name" value={item.name} onChange={e => {
                const updated = [...extraEquipment]; updated[i] = { ...updated[i], name: e.target.value }; setExtraEquipment(updated)
              }} />
              <Input placeholder="Cost (ZAR)" type="number" value={item.cost} onChange={e => {
                const updated = [...extraEquipment]; updated[i] = { ...updated[i], cost: e.target.value }; setExtraEquipment(updated)
              }} className="w-32" />
              <Button type="button" size="icon" variant="ghost" onClick={() => setExtraEquipment(prev => prev.filter((_, idx) => idx !== i))}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Travel Method</Label>
        <Select value={travelMethod} onChange={e => setTravelMethod(e.target.value)}>
          <option value="none">None</option>
          <option value="driving">Driving</option>
          <option value="flying">Flying</option>
        </Select>
      </div>

      {travelMethod !== 'none' && (
        <div>
          <Label>Shoot Location</Label>
          <PlacesAutocomplete
            name="shootLocation"
            defaultValue={shoot?.shootLocation ?? ''}
            placeholder="Start typing an address..."
            onSelect={addr => setLocationAddress(addr)}
            onChange={val => setLocationAddress(val)}
          />
        </div>
      )}

      {travelMethod === 'driving' && (
        <div>
          <Label>Driving Distance (km one way)</Label>
          <div className="flex gap-2">
            <Input name="distanceKm" type="number" min="0" step="0.1" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} />
            <Button
              type="button"
              variant="outline"
              onClick={handleCalculateDistance}
              disabled={!locationAddress.trim() || calculatingDistance}
              className="shrink-0"
            >
              {calculatingDistance ? <Loader2 size={14} className="animate-spin" /> : <><MapPin size={14} /> Calculate</>}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Cost = distance × 2 (return) × per-km rate (set in Settings)</p>
        </div>
      )}

      {travelMethod === 'flying' && (
        <div>
          <Label>Return Airfare Cost (ZAR)</Label>
          <Input name="airfareCost" type="number" min="0" step="0.01" defaultValue={shoot?.airfareCost ?? ''} />
        </div>
      )}

      {travelMethod !== 'none' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Accommodation Nights</Label>
            <Input name="accommodationNights" type="number" min="0" defaultValue={shoot?.accommodationNights ?? ''} />
          </div>
          <div>
            <Label>Cost Per Night (ZAR)</Label>
            <Input name="accommodationPerNight" type="number" min="0" step="0.01" defaultValue={shoot?.accommodationPerNight ?? ''} />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save Shoot'}</Button>
      </div>
    </form>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ShootsClient({
  projectId,
  projectStatus,
  shoots: initialShoots,
  pricingMap,
  settings,
}: {
  projectId: string
  projectStatus: string
  shoots: Shoot[]
  pricingMap: Record<string, number>
  settings: any
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [shootDialog, setShootDialog] = useState<{ open: boolean; shoot?: Shoot }>({ open: false })
  const [deleteShootId, setDeleteShootId] = useState<string | null>(null)

  const isLocked = ['invoiced', 'paid'].includes(projectStatus)
  const shootTotal = initialShoots.reduce((sum, s) => sum + s.calculatedShootCost, 0)

  function handleSaveShoot(fd: FormData) {
    startTransition(async () => {
      await saveShootDetails(projectId, shootDialog.shoot?.id ?? null, fd)
      toast(shootDialog.shoot ? 'Shoot updated' : 'Shoot added')
      setShootDialog({ open: false })
      router.refresh()
    })
  }

  function handleDeleteShoot() {
    if (!deleteShootId) return
    startTransition(async () => {
      await deleteShootDetails(deleteShootId, projectId)
      toast('Shoot removed')
      setDeleteShootId(null)
      router.refresh()
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Shoot Days</CardTitle>
            {!isLocked && (
              <Button size="sm" onClick={() => setShootDialog({ open: true })}>
                <Plus size={14} /> Add Shoot Day
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {initialShoots.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-gray-400">No shoot days added yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {initialShoots.map(s => (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">
                          {s.shootLabel || (s.shootType === 'half_day' ? 'Half Day' : 'Full Day')}
                        </p>
                        {s.shootDate && <span className="text-xs text-gray-400">{s.shootDate}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.shootType === 'half_day' ? 'Half Day' : 'Full Day'} · {s.cameraBody === 'a7siii' ? 'Sony a7SIII' : 'Sony a7III'}
                        {s.hasSecondShooter && ` · Second Shooter`}
                        {s.hasSoundKit && ` · Sound Kit`}
                        {s.hasLighting && ` · Lighting`}
                        {s.hasGimbal && ` · Gimbal`}
                      </p>
                      {s.travelMethod && s.travelMethod !== 'none' && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          Travel: {s.travelMethod}
                          {s.shootLocation && ` — ${s.shootLocation}`}
                          {s.distanceKm && ` (${s.distanceKm}km)`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-gray-900">{formatCurrency(s.calculatedShootCost)}</span>
                      {!isLocked && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setShootDialog({ open: true, shoot: s })}>
                            <Edit size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteShootId(s.id)}>
                            <Trash2 size={14} className="text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {initialShoots.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <span className="text-sm font-medium text-gray-600">Total: <span className="text-gray-900 font-bold">{formatCurrency(shootTotal)}</span></span>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={shootDialog.open}
        onClose={() => setShootDialog({ open: false })}
        title={shootDialog.shoot ? 'Edit Shoot Day' : 'Add Shoot Day'}
        className="max-w-2xl"
      >
        <ShootForm
          shoot={shootDialog.shoot}
          settings={settings}
          onSave={handleSaveShoot}
          onClose={() => setShootDialog({ open: false })}
        />
      </Dialog>

      <ConfirmDialog
        open={!!deleteShootId}
        onClose={() => setDeleteShootId(null)}
        onConfirm={handleDeleteShoot}
        title="Remove Shoot Day"
        message="Are you sure you want to remove this shoot day? This cannot be undone."
        confirmLabel="Remove Shoot"
      />
    </div>
  )
}

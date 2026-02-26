'use client'
import { useState, useTransition, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import {
  formatCurrency, formatDate, getStatusBadgeClass, getStatusConfig, PROJECT_STATUSES,
  getDurationBracket, getBracketLabel, DURATION_BRACKETS
} from '@/lib/utils'
import {
  updateProject, updateProjectStatus, deleteProject,
  saveDeliverable, deleteDeliverable,
  saveShootDetails, deleteShootDetails,
  addRevision, updateRevisionStatus, calculateDeliverableCost,
  updateDeliverableNameAndCost
} from '../actions'
import {
  Edit, Trash2, Plus, AlertTriangle, ExternalLink, Camera, Package,
  RotateCcw, FileText, ChevronDown, ChevronUp, Loader2, MapPin, Clapperboard,
  Link2Off
} from 'lucide-react'
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { LinkProjectModal } from '@/components/frameio/link-project-modal'
import { unlinkFrameIoProject } from '@/app/frameio/actions'
import { AssetBrowser } from '@/components/frameio/asset-browser'

type Project = {
  id: string; name: string; status: string; startDate: string; deadline: string;
  includedRevisionRounds: number | null; frameIoLink: string | null; drivefinalsLink: string | null;
  driveArchiveLink: string | null; notes: string | null; invoiceId: string | null;
  productionCompanyId: string; clientId: string; clientName: string | null; companyName: string | null;
  frameioProjectId: string | null; frameioProjectName: string | null; frameioRootAssetId: string | null; frameioAccountId: string | null; frameioUnreadComments: number | null;
}

type Deliverable = {
  id: string; name: string; videoLengthSeconds: number; durationBracket: string;
  primaryFormat: string; editType: string; colourGrading: string | null; subtitles: string | null;
  additionalFormats: number | null; hasCustomMusic: boolean | null; customMusicCost: number | null;
  hasCustomGraphics: boolean | null; customGraphicsDescription: string | null; customGraphicsCost: number | null;
  rushFeeType: string | null; calculatedCost: number; notes: string | null;
}
type Shoot = {
  id: string; projectId: string; shootType: string; cameraBody: string;
  hasSecondShooter: boolean | null; secondShooterType: string | null;
  hasSoundKit: boolean | null; soundKitType: string | null;
  hasLighting: boolean | null; lightingType: string | null;
  hasGimbal: boolean | null; gimbalType: string | null;
  additionalEquipment: string | null; travelMethod: string | null;
  shootLocation: string | null; distanceKm: number | null; airfareCost: number | null;
  accommodationNights: number | null; accommodationPerNight: number | null;
  calculatedShootCost: number;
}
type Revision = {
  id: string; roundNumber: number; dateRequested: string; description: string;
  frameIoLink: string | null; status: string | null;
}

const BRACKET_SECONDS: Record<string, number> = {
  '5_10': 10, '15_20': 20, '30_45': 45, '60': 60, '90': 90, '120_180': 180, '180_240': 240, '300_plus': 300
}

// ─── Deliverable Form ─────────────────────────────────────────────────────────
function DeliverableForm({ deliverable, pricingMap, onSave, onClose }: {
  deliverable?: Deliverable; pricingMap: Record<string, number>; onSave: (fd: FormData) => void; onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [previewCost, setPreviewCost] = useState<number | null>(deliverable?.calculatedCost ?? null)
  const [editType, setEditType] = useState(deliverable?.editType ?? 'basic')
  const [hasCustomMusic, setHasCustomMusic] = useState(!!deliverable?.hasCustomMusic)
  const [hasCustomGraphics, setHasCustomGraphics] = useState(!!deliverable?.hasCustomGraphics)
  const [calculating, setCalculating] = useState(false)

  function getFormData(form: HTMLFormElement): FormData {
    const fd = new FormData(form)
    fd.set('hasCustomMusic', hasCustomMusic.toString())
    fd.set('hasCustomGraphics', hasCustomGraphics.toString())
    return fd
  }

  async function handlePreview(form: HTMLFormElement) {
    setCalculating(true)
    const fd = getFormData(form)
    const cost = await calculateDeliverableCost(fd)
    setPreviewCost(cost)
    setCalculating(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = getFormData(e.currentTarget)
    startTransition(() => onSave(fd))
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={e => handlePreview(e.currentTarget)}
      className="p-6 space-y-4"
    >
      <div>
        <Label>Deliverable Name *</Label>
        <Input name="name" defaultValue={deliverable?.name} placeholder='e.g. "Hero 90sec Landscape"' required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Video Length (seconds) *</Label>
          <Input name="videoLengthSeconds" type="number" min="1" defaultValue={deliverable?.videoLengthSeconds} required
            placeholder="e.g. 90" />
        </div>
        <div>
          <Label>Primary Format *</Label>
          <Select name="primaryFormat" defaultValue={deliverable?.primaryFormat} required>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
            <option value="square">Square</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>Edit Type *</Label>
        <Select name="editType" defaultValue={editType} onChange={e => setEditType(e.target.value)} required>
          <option value="basic">Basic Edit</option>
          <option value="advanced">Advanced Edit</option>
          <option value="colour_only">Colour &amp; Finishing Only</option>
        </Select>
      </div>

      {editType !== 'colour_only' && (
        <div>
          <Label>Colour Grading</Label>
          <Select name="colourGrading" defaultValue={deliverable?.colourGrading ?? 'none'}>
            <option value="none">None</option>
            <option value="standard">Standard</option>
            <option value="advanced">Advanced</option>
          </Select>
        </div>
      )}

      {editType === 'colour_only' && (
        <div>
          <Label>Grade Level *</Label>
          <Select name="colourGrading" defaultValue={deliverable?.colourGrading ?? 'standard'} required>
            <option value="standard">Standard</option>
            <option value="advanced">Advanced</option>
          </Select>
        </div>
      )}

      <div>
        <Label>Subtitles / Captions</Label>
        <Select name="subtitles" defaultValue={deliverable?.subtitles ?? 'none'}>
          <option value="none">None</option>
          <option value="basic">Basic</option>
          <option value="styled">Styled &amp; Animated</option>
        </Select>
      </div>

      <div>
        <Label>Additional Formats (extra aspect ratios)</Label>
        <Input name="additionalFormats" type="number" min="0" defaultValue={deliverable?.additionalFormats ?? 0} />
        <p className="text-xs text-gray-400 mt-1">Each charged at 20% of base edit price</p>
      </div>

      <div>
        <Label>Rush Fee</Label>
        <Select name="rushFeeType" defaultValue={deliverable?.rushFeeType ?? 'none'}>
          <option value="none">None</option>
          <option value="standard">Standard Rush (+25%)</option>
          <option value="emergency">Emergency Rush (+50%)</option>
        </Select>
      </div>

      {/* Custom Music */}
      <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
        <input type="checkbox" id="hasCustomMusic" checked={hasCustomMusic} onChange={e => setHasCustomMusic(e.target.checked)} className="mt-1" />
        <div className="flex-1">
          <label htmlFor="hasCustomMusic" className="text-sm font-medium text-gray-700 cursor-pointer">Custom / Licensed Music</label>
          {hasCustomMusic && (
            <div className="mt-2">
              <Label>Music Cost (ZAR)</Label>
              <Input name="customMusicCost" type="number" min="0" step="0.01" defaultValue={deliverable?.customMusicCost ?? ''} />
            </div>
          )}
        </div>
      </div>

      {/* Custom Graphics */}
      <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
        <input type="checkbox" id="hasCustomGraphics" checked={hasCustomGraphics} onChange={e => setHasCustomGraphics(e.target.checked)} className="mt-1" />
        <div className="flex-1">
          <label htmlFor="hasCustomGraphics" className="text-sm font-medium text-gray-700 cursor-pointer">Custom / Motion Graphics</label>
          {hasCustomGraphics && (
            <div className="mt-2 space-y-2">
              <div>
                <Label>Description</Label>
                <Input name="customGraphicsDescription" defaultValue={deliverable?.customGraphicsDescription ?? ''} />
              </div>
              <div>
                <Label>Cost (ZAR)</Label>
                <Input name="customGraphicsCost" type="number" min="0" step="0.01" defaultValue={deliverable?.customGraphicsCost ?? ''} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea name="notes" defaultValue={deliverable?.notes ?? ''} rows={2} />
      </div>

      {/* Live cost preview */}
      <div className={`rounded-lg p-4 ${previewCost !== null ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50'}`}>
        <p className="text-xs text-gray-500 mb-1">Calculated Cost</p>
        <p className="text-2xl font-bold text-gray-900">
          {calculating ? <Loader2 className="animate-spin inline" size={20} /> : previewCost !== null ? formatCurrency(previewCost) : '—'}
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save Deliverable'}</Button>
      </div>
    </form>
  )
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

      {/* Optional gear */}
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
            {item.has && (
              <div className="mt-2">{dayTypeSelect(item.typeField, item.typeVal)}</div>
            )}
          </div>
        </div>
      ))}

      {/* Additional equipment */}
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

      {/* Travel */}
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
            <Input
              name="distanceKm"
              type="number"
              min="0"
              step="0.1"
              value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCalculateDistance}
              disabled={!locationAddress.trim() || calculatingDistance}
              className="shrink-0"
              title="Calculate distance from your base location"
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

      {(travelMethod !== 'none') && (
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
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save Shoot Details'}</Button>
      </div>
    </form>
  )
}

// ─── Revision Form ────────────────────────────────────────────────────────────
function RevisionForm({ onSave, onClose }: { onSave: (fd: FormData) => void; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => onSave(fd)) }} className="p-6 space-y-4">
      <div>
        <Label>Date Requested *</Label>
        <Input name="dateRequested" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
      </div>
      <div>
        <Label>Description *</Label>
        <Textarea name="description" rows={3} required placeholder="Brief description of changes requested..." />
      </div>
      <div>
        <Label>Frame.io Review Link</Label>
        <Input name="frameIoLink" type="url" placeholder="https://..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Log Revision'}</Button>
      </div>
    </form>
  )
}

// ─── Edit Project Form ─────────────────────────────────────────────────────────
function EditProjectForm({ project, companies, clients, onSave, onClose }: {
  project: Project; companies: any[]; clients: any[]; onSave: (fd: FormData) => void; onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [selectedCompanyId, setSelectedCompanyId] = useState(project.productionCompanyId)
  const filteredClients = clients.filter((c: any) => c.productionCompanyId === selectedCompanyId)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => onSave(fd))
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <Label>Project Name *</Label>
        <Input name="name" defaultValue={project.name} required />
      </div>
      <div>
        <Label>Production Company *</Label>
        <Select name="productionCompanyId" defaultValue={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} required>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div>
        <Label>Client *</Label>
        <Select name="clientId" defaultValue={project.clientId} required>
          {filteredClients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date *</Label>
          <Input name="startDate" type="date" defaultValue={project.startDate} required />
        </div>
        <div>
          <Label>Deadline *</Label>
          <Input name="deadline" type="date" defaultValue={project.deadline} required />
        </div>
      </div>
      <div>
        <Label>Included Revision Rounds</Label>
        <Input name="includedRevisionRounds" type="number" min="0" defaultValue={project.includedRevisionRounds ?? 2} />
      </div>
      <div>
        <Label>Frame.io Project Link</Label>
        <Input name="frameIoLink" type="url" defaultValue={project.frameIoLink ?? ''} />
      </div>
      <div>
        <Label>Google Drive — Finals Link</Label>
        <Input name="drivefinalsLink" type="url" defaultValue={project.drivefinalsLink ?? ''} />
      </div>
      <div>
        <Label>Google Drive — Archive Link</Label>
        <Input name="driveArchiveLink" type="url" defaultValue={project.driveArchiveLink ?? ''} />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea name="notes" defaultValue={project.notes ?? ''} rows={4} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Update Project'}</Button>
      </div>
    </form>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ProjectDetailClient({ project, deliverables: initialDeliverables, shoot: initialShoot, revisions: initialRevisions, pricingMap, settings, companies, clients, isFrameioConnected }: {
  project: Project; deliverables: Deliverable[]; shoot: Shoot | null; revisions: Revision[];
  pricingMap: Record<string, number>; settings: any; companies: any[]; clients: any[];
  isFrameioConnected: boolean;
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [deliverableDialog, setDeliverableDialog] = useState<{ open: boolean; deliverable?: Deliverable }>({ open: false })
  const [shootDialog, setShootDialog] = useState(false)
  const [revisionDialog, setRevisionDialog] = useState(false)
  const [deleteDeliverableId, setDeleteDeliverableId] = useState<string | null>(null)
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false)
  const [deleteShootConfirm, setDeleteShootConfirm] = useState(false)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEdits, setBulkEdits] = useState<Record<string, { name: string; cost: string }>>({})
  const [bulkSaving, setBulkSaving] = useState(false)
  const [linkFrameioOpen, setLinkFrameioOpen] = useState(false)
  const [unlinkingFrameio, setUnlinkingFrameio] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const isLocked = ['invoiced', 'paid'].includes(project.status)

  // Totals
  const deliverableTotal = initialDeliverables.reduce((sum, d) => sum + d.calculatedCost, 0)
  const shootTotal = initialShoot?.calculatedShootCost ?? 0
  const projectTotal = deliverableTotal + shootTotal

  // Warning: exceeded revisions
  const includedRounds = project.includedRevisionRounds ?? 2
  const revisionWarning = initialRevisions.length > includedRounds

  // Current pricing mismatch check
  function checkPriceMismatch(d: Deliverable): boolean {
    // simplified check — if pricing config changed
    return false // would require re-calculation
  }

  function enterBulkEdit() {
    const initial: Record<string, { name: string; cost: string }> = {}
    for (const d of initialDeliverables) {
      initial[d.id] = { name: d.name, cost: String(d.calculatedCost) }
    }
    setBulkEdits(initial)
    setBulkEditMode(true)
  }

  async function saveBulkEdits() {
    setBulkSaving(true)
    for (const d of initialDeliverables) {
      const edit = bulkEdits[d.id]
      if (!edit) continue
      const newName = edit.name.trim() || d.name
      const newCost = parseFloat(edit.cost) || 0
      if (newName !== d.name || newCost !== d.calculatedCost) {
        await updateDeliverableNameAndCost(d.id, newName, newCost)
      }
    }
    setBulkSaving(false)
    setBulkEditMode(false)
    router.refresh()
  }

  function cancelBulkEdit() {
    setBulkEditMode(false)
    setBulkEdits({})
  }

  async function handleUnlinkFrameio() {
    setUnlinkingFrameio(true)
    try {
      await unlinkFrameIoProject(project.id)
      toast('Frame.io project unlinked')
      router.refresh()
    } finally {
      setUnlinkingFrameio(false)
    }
  }

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      try {
        await updateProjectStatus(project.id, newStatus)
        toast(`Status updated to ${getStatusConfig(newStatus).label}`)
        router.refresh()
      } catch (e: any) {
        toast(e.message, 'error')
      }
    })
  }

  function handleDeleteProject() {
    startTransition(async () => {
      try {
        await deleteProject(project.id)
        toast('Project deleted')
        router.push('/projects')
      } catch (e: any) {
        toast(e.message, 'error')
      }
    })
  }

  function handleSaveDeliverable(fd: FormData) {
    startTransition(async () => {
      await saveDeliverable(project.id, deliverableDialog.deliverable?.id ?? null, fd)
      toast(deliverableDialog.deliverable ? 'Deliverable updated' : 'Deliverable added')
      setDeliverableDialog({ open: false })
      router.refresh()
    })
  }

  function handleDeleteDeliverable() {
    if (!deleteDeliverableId) return
    startTransition(async () => {
      await deleteDeliverable(deleteDeliverableId, project.id)
      toast('Deliverable deleted')
      setDeleteDeliverableId(null)
      router.refresh()
    })
  }

  function handleSaveShoot(fd: FormData) {
    startTransition(async () => {
      await saveShootDetails(project.id, fd)
      toast('Shoot details saved')
      setShootDialog(false)
      router.refresh()
    })
  }

  function handleDeleteShoot() {
    startTransition(async () => {
      await deleteShootDetails(project.id)
      toast('Shoot details removed')
      setDeleteShootConfirm(false)
      router.refresh()
    })
  }

  function handleAddRevision(fd: FormData) {
    startTransition(async () => {
      await addRevision(project.id, fd)
      toast('Revision logged')
      setRevisionDialog(false)
      router.refresh()
    })
  }

  function handleUpdateRevisionStatus(id: string, status: string) {
    startTransition(async () => {
      await updateRevisionStatus(id, project.id, status)
      toast('Revision updated')
      router.refresh()
    })
  }

  const isOverdue = ['enquiry','quoted','confirmed','in_production','in_post','review','revisions','final_delivery'].includes(project.status) && project.deadline < today

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Revision warning */}
      {revisionWarning && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertTriangle size={18} className="text-yellow-600 shrink-0" />
          <p>This project has exceeded the included revision rounds ({includedRounds} included, {initialRevisions.length} logged). Consider adding a revision charge.</p>
        </div>
      )}

      {/* Project header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={getStatusBadgeClass(project.status)}>{getStatusConfig(project.status).label}</Badge>
            {isOverdue && <Badge className="bg-red-100 text-red-700"><AlertTriangle size={12} className="inline mr-1" />Overdue</Badge>}
          </div>
          <div className="mt-2 text-sm text-gray-600 space-y-0.5">
            <p><span className="font-medium">{project.companyName}</span> · {project.clientName}</p>
            <p>Start: {formatDate(project.startDate)} · Deadline: <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{formatDate(project.deadline)}</span></p>
            {project.frameIoLink && <a href={project.frameIoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"><ExternalLink size={12} />Frame.io</a>}
            {project.drivefinalsLink && <a href={project.drivefinalsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs ml-3"><ExternalLink size={12} />Finals Drive</a>}
            {project.driveArchiveLink && <a href={project.driveArchiveLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs ml-3"><ExternalLink size={12} />Archive</a>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditProjectOpen(true)} disabled={isLocked}>
            <Edit size={14} /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteProjectConfirm(true)} disabled={isLocked}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Status pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PROJECT_STATUSES.map(s => (
              <button
                key={s.key}
                onClick={() => handleStatusChange(s.key)}
                disabled={s.key === project.status}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                  ${s.key === project.status
                    ? 'ring-2 ring-offset-1 ring-[#1e3a5f] ' + getStatusBadgeClass(s.key)
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Project notes */}
      {project.notes && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{project.notes}</p></CardContent>
        </Card>
      )}

      {/* Frame.io */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clapperboard size={17} />Frame.io
            </CardTitle>
            <div className="flex items-center gap-2">
              {project.frameioProjectId ? (
                <Button size="sm" variant="ghost" onClick={handleUnlinkFrameio} disabled={unlinkingFrameio}
                  title="Unlink Frame.io project">
                  <Link2Off size={13} className="text-red-500" />
                </Button>
              ) : isFrameioConnected ? (
                <Button size="sm" variant="outline" onClick={() => setLinkFrameioOpen(true)}>
                  <Clapperboard size={13} /> Link Project
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isFrameioConnected ? (
            <p className="text-sm text-gray-400">
              Frame.io not connected.{' '}
              <a href="/settings?tab=integrations" className="text-blue-600 hover:underline">Go to Settings</a> to connect.
            </p>
          ) : !project.frameioProjectId ? (
            <p className="text-sm text-gray-400">No Frame.io project linked. Click "Link Project" to connect one.</p>
          ) : (
            <AssetBrowser
              frameioProjectId={project.frameioProjectId!}
              rootAssetId={project.frameioRootAssetId}
              accountId={project.frameioAccountId}
              projectName={project.frameioProjectName ?? 'Project'}
            />
          )}
        </CardContent>
      </Card>

      {/* Deliverables */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Package size={17} />Deliverables</CardTitle>
            <div className="flex items-center gap-2">
              {!isLocked && !bulkEditMode && initialDeliverables.length > 0 && (
                <Button size="sm" variant="outline" onClick={enterBulkEdit}>
                  <Edit size={14} /> Edit
                </Button>
              )}
              {bulkEditMode && (
                <>
                  <Button size="sm" variant="outline" onClick={cancelBulkEdit} disabled={bulkSaving}>Cancel</Button>
                  <Button size="sm" onClick={saveBulkEdits} disabled={bulkSaving}>
                    {bulkSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save'}
                  </Button>
                </>
              )}
              {!isLocked && !bulkEditMode && (
                <Button size="sm" onClick={() => setDeliverableDialog({ open: true })}>
                  <Plus size={14} /> Add Deliverable
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {initialDeliverables.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-gray-400">No deliverables yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {initialDeliverables.map(d => (
                <div key={d.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {bulkEditMode ? (
                        <Input
                          value={bulkEdits[d.id]?.name ?? d.name}
                          onChange={e => setBulkEdits(prev => ({ ...prev, [d.id]: { ...prev[d.id], name: e.target.value } }))}
                          className="font-medium h-8 mb-1"
                        />
                      ) : (
                        <p className="font-medium text-gray-900">{d.name}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {getBracketLabel(d.durationBracket)} · {d.primaryFormat} · {d.editType === 'colour_only' ? 'Colour Only' : d.editType === 'basic' ? 'Basic Edit' : 'Advanced Edit'}
                        {d.colourGrading && d.colourGrading !== 'none' && ` · ${d.colourGrading} grading`}
                        {d.subtitles && d.subtitles !== 'none' && ` · ${d.subtitles} subtitles`}
                        {d.additionalFormats ? ` · ${d.additionalFormats} extra format(s)` : ''}
                        {d.rushFeeType && d.rushFeeType !== 'none' && ` · ${d.rushFeeType === 'standard' ? 'Standard Rush' : 'Emergency Rush'}`}
                      </p>
                      {d.notes && <p className="text-xs text-gray-400 mt-1">{d.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {bulkEditMode ? (
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={bulkEdits[d.id]?.cost ?? String(d.calculatedCost)}
                          onChange={e => setBulkEdits(prev => ({ ...prev, [d.id]: { ...prev[d.id], cost: e.target.value } }))}
                          className="w-28 text-right h-8 font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-900">{formatCurrency(d.calculatedCost)}</span>
                      )}
                      {!isLocked && !bulkEditMode && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setDeliverableDialog({ open: true, deliverable: d })}>
                            <Edit size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteDeliverableId(d.id)}>
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
          {initialDeliverables.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <span className="text-sm font-medium text-gray-600">Deliverables Total: <span className="text-gray-900 font-bold">{formatCurrency(deliverableTotal)}</span></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shoot Details */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Camera size={17} />Shoot Details</CardTitle>
            <div className="flex gap-2">
              {!isLocked && (
                <Button size="sm" variant="outline" onClick={() => setShootDialog(true)}>
                  {initialShoot ? <><Edit size={14} /> Edit Shoot</> : <><Plus size={14} /> Add Shoot</>}
                </Button>
              )}
              {initialShoot && !isLocked && (
                <Button size="sm" variant="ghost" onClick={() => setDeleteShootConfirm(true)}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!initialShoot ? (
            <p className="text-sm text-gray-400">No shoot for this project.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-500">Type:</span> <span className="font-medium">{initialShoot.shootType === 'half_day' ? 'Half Day' : 'Full Day'}</span></div>
                <div><span className="text-gray-500">Camera:</span> <span className="font-medium">{initialShoot.cameraBody === 'a7siii' ? 'Sony a7SIII' : 'Sony a7III'}</span></div>
                {initialShoot.hasSecondShooter && <div><span className="text-gray-500">Second Shooter:</span> <span className="font-medium">{initialShoot.secondShooterType?.replace('_', ' ')}</span></div>}
                {initialShoot.hasSoundKit && <div><span className="text-gray-500">Sound Kit:</span> <span className="font-medium">{initialShoot.soundKitType?.replace('_', ' ')}</span></div>}
                {initialShoot.hasLighting && <div><span className="text-gray-500">Lighting:</span> <span className="font-medium">{initialShoot.lightingType?.replace('_', ' ')}</span></div>}
                {initialShoot.hasGimbal && <div><span className="text-gray-500">Gimbal:</span> <span className="font-medium">{initialShoot.gimbalType?.replace('_', ' ')}</span></div>}
              </div>
              {initialShoot.travelMethod && initialShoot.travelMethod !== 'none' && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <p className="font-medium text-blue-800">Travel: {initialShoot.travelMethod}</p>
                  {initialShoot.shootLocation && <p className="text-xs text-blue-700">{initialShoot.shootLocation}</p>}
                  {initialShoot.distanceKm && <p className="text-xs text-blue-700">{initialShoot.distanceKm}km (one way)</p>}
                </div>
              )}
              <div className="flex justify-end pt-2">
                <span className="font-semibold text-gray-900">Shoot Total: {formatCurrency(initialShoot.calculatedShootCost)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revisions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw size={17} />
              Revisions <span className="text-gray-500 font-normal text-sm">({initialRevisions.length}/{includedRounds} included)</span>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setRevisionDialog(true)}>
              <Plus size={14} /> Log Revision
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {initialRevisions.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-gray-400">No revisions logged.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {initialRevisions.map(r => (
                <div key={r.id} className="px-6 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Round {r.roundNumber} · {formatDate(r.dateRequested)}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{r.description}</p>
                      {r.frameIoLink && (
                        <a href={r.frameIoLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                          <ExternalLink size={11} />Frame.io link
                        </a>
                      )}
                    </div>
                    <Select
                      value={r.status ?? 'pending'}
                      onChange={e => handleUpdateRevisionStatus(r.id, e.target.value)}
                      className="w-36 h-8 text-xs"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="complete">Complete</option>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Total */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardContent className="py-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-white/70 text-sm">Project Total (Invoiceable Amount)</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(projectTotal)}</p>
            </div>
            <div className="text-right text-sm text-white/70 space-y-1">
              <p>Deliverables: {formatCurrency(deliverableTotal)}</p>
              {shootTotal > 0 && <p>Shoot: {formatCurrency(shootTotal)}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={editProjectOpen} onClose={() => setEditProjectOpen(false)} title="Edit Project" className="max-w-2xl">
        <EditProjectForm
          project={project}
          companies={companies}
          clients={clients}
          onSave={fd => { updateProject(project.id, fd).then(() => { toast('Project updated'); setEditProjectOpen(false); router.refresh() }) }}
          onClose={() => setEditProjectOpen(false)}
        />
      </Dialog>

      <Dialog open={deliverableDialog.open} onClose={() => setDeliverableDialog({ open: false })}
        title={deliverableDialog.deliverable ? 'Edit Deliverable' : 'Add Deliverable'} className="max-w-2xl">
        <DeliverableForm
          deliverable={deliverableDialog.deliverable}
          pricingMap={pricingMap}
          onSave={handleSaveDeliverable}
          onClose={() => setDeliverableDialog({ open: false })}
        />
      </Dialog>

      <Dialog open={shootDialog} onClose={() => setShootDialog(false)} title={initialShoot ? 'Edit Shoot Details' : 'Add Shoot Details'} className="max-w-2xl">
        <ShootForm
          shoot={initialShoot}
          settings={settings}
          onSave={handleSaveShoot}
          onClose={() => setShootDialog(false)}
        />
      </Dialog>

      <Dialog open={revisionDialog} onClose={() => setRevisionDialog(false)} title="Log Revision Round">
        <RevisionForm onSave={handleAddRevision} onClose={() => setRevisionDialog(false)} />
      </Dialog>

      <ConfirmDialog
        open={!!deleteDeliverableId}
        onClose={() => setDeleteDeliverableId(null)}
        onConfirm={handleDeleteDeliverable}
        title="Delete Deliverable"
        message="Are you sure you want to delete this deliverable? This cannot be undone."
      />

      <ConfirmDialog
        open={deleteProjectConfirm}
        onClose={() => setDeleteProjectConfirm(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message="This will permanently delete this project and all its deliverables, shoot details, and revisions. This cannot be undone."
        confirmLabel="Delete Project"
      />

      <ConfirmDialog
        open={deleteShootConfirm}
        onClose={() => setDeleteShootConfirm(false)}
        onConfirm={handleDeleteShoot}
        title="Remove Shoot Details"
        message="Are you sure you want to remove shoot details from this project?"
        confirmLabel="Remove Shoot"
      />

      <LinkProjectModal
        appProjectId={project.id}
        open={linkFrameioOpen}
        onClose={() => setLinkFrameioOpen(false)}
      />
    </div>
  )
}

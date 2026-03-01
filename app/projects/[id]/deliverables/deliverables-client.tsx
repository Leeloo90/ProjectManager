'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, getBracketLabel } from '@/lib/utils'
import {
  saveDeliverable, deleteDeliverable, calculateDeliverableCost, updateDeliverableNameAndCost
} from '../../actions'
import { Edit, Trash2, Plus, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Deliverable = {
  id: string; name: string; videoLengthSeconds: number; durationBracket: string;
  primaryFormat: string; editType: string; colourGrading: string | null; subtitles: string | null;
  additionalFormats: number | null; hasCustomMusic: boolean | null; customMusicCost: number | null;
  hasCustomGraphics: boolean | null; customGraphicsDescription: string | null; customGraphicsCost: number | null;
  rushFeeType: string | null; calculatedCost: number; notes: string | null;
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
          <Input name="videoLengthSeconds" type="number" min="1" defaultValue={deliverable?.videoLengthSeconds} required placeholder="e.g. 90" />
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export function DeliverablesClient({
  projectId,
  projectStatus,
  deliverables: initialDeliverables,
  pricingMap,
  settings,
}: {
  projectId: string
  projectStatus: string
  deliverables: Deliverable[]
  pricingMap: Record<string, number>
  settings: any
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [deliverableDialog, setDeliverableDialog] = useState<{ open: boolean; deliverable?: Deliverable }>({ open: false })
  const [deleteDeliverableId, setDeleteDeliverableId] = useState<string | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEdits, setBulkEdits] = useState<Record<string, { name: string; cost: string }>>({})
  const [bulkSaving, setBulkSaving] = useState(false)

  const isLocked = ['invoiced', 'paid'].includes(projectStatus)
  const deliverableTotal = initialDeliverables.reduce((sum, d) => sum + d.calculatedCost, 0)

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

  function handleSaveDeliverable(fd: FormData) {
    startTransition(async () => {
      await saveDeliverable(projectId, deliverableDialog.deliverable?.id ?? null, fd)
      toast(deliverableDialog.deliverable ? 'Deliverable updated' : 'Deliverable added')
      setDeliverableDialog({ open: false })
      router.refresh()
    })
  }

  function handleDeleteDeliverable() {
    if (!deleteDeliverableId) return
    startTransition(async () => {
      await deleteDeliverable(deleteDeliverableId, projectId)
      toast('Deliverable deleted')
      setDeleteDeliverableId(null)
      router.refresh()
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Deliverables</CardTitle>
            <div className="flex items-center gap-2">
              {!isLocked && !bulkEditMode && initialDeliverables.length > 0 && (
                <Button size="sm" variant="outline" onClick={enterBulkEdit}>
                  <Edit size={14} /> Bulk Edit
                </Button>
              )}
              {bulkEditMode && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setBulkEditMode(false); setBulkEdits({}) }} disabled={bulkSaving}>Cancel</Button>
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
              <span className="text-sm font-medium text-gray-600">Total: <span className="text-gray-900 font-bold">{formatCurrency(deliverableTotal)}</span></span>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deliverableDialog.open}
        onClose={() => setDeliverableDialog({ open: false })}
        title={deliverableDialog.deliverable ? 'Edit Deliverable' : 'Add Deliverable'}
        className="max-w-2xl"
      >
        <DeliverableForm
          deliverable={deliverableDialog.deliverable}
          pricingMap={pricingMap}
          onSave={handleSaveDeliverable}
          onClose={() => setDeliverableDialog({ open: false })}
        />
      </Dialog>

      <ConfirmDialog
        open={!!deleteDeliverableId}
        onClose={() => setDeleteDeliverableId(null)}
        onConfirm={handleDeleteDeliverable}
        title="Delete Deliverable"
        message="Are you sure you want to delete this deliverable? This cannot be undone."
      />
    </div>
  )
}

'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'
import { addRevision, updateRevisionStatus } from '../../actions'
import { Plus, AlertTriangle, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

type Revision = {
  id: string; roundNumber: number; dateRequested: string; description: string; status: string | null
}

function RevisionForm({ onSave, onClose }: { onSave: (fd: FormData) => void; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => onSave(fd)) }}
      className="p-6 space-y-4"
    >
      <div>
        <Label>Date Requested *</Label>
        <Input name="dateRequested" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
      </div>
      <div>
        <Label>Description *</Label>
        <Textarea name="description" rows={3} required placeholder="Brief description of changes requested..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Log Revision'}</Button>
      </div>
    </form>
  )
}

export function RevisionsClient({
  projectId,
  projectStatus,
  includedRevisionRounds,
  revisions: initialRevisions,
}: {
  projectId: string
  projectStatus: string
  includedRevisionRounds: number
  revisions: Revision[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [revisionDialog, setRevisionDialog] = useState(false)

  const revisionWarning = initialRevisions.length > includedRevisionRounds
  const extraRounds = Math.max(0, initialRevisions.length - includedRevisionRounds)

  function handleAddRevision(fd: FormData) {
    startTransition(async () => {
      await addRevision(projectId, fd)
      toast('Revision logged')
      setRevisionDialog(false)
      router.refresh()
    })
  }

  function handleUpdateRevisionStatus(id: string, status: string) {
    startTransition(async () => {
      await updateRevisionStatus(id, projectId, status)
      toast('Revision updated')
      router.refresh()
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {revisionWarning && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertTriangle size={18} className="text-yellow-600 shrink-0" />
          <p>
            This project has exceeded the included revision rounds — {includedRevisionRounds} included, {initialRevisions.length} logged
            ({extraRounds} extra {extraRounds === 1 ? 'round' : 'rounds'}). Consider adding a revision charge to the invoice.
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw size={17} />
              Revisions
              <span className="text-gray-500 font-normal text-sm">({initialRevisions.length}/{includedRevisionRounds} included)</span>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setRevisionDialog(true)}>
              <Plus size={14} /> Log Revision
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {initialRevisions.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-gray-400">No revisions logged yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {initialRevisions.map(r => (
                <div key={r.id} className="px-6 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Round {r.roundNumber}
                        {r.roundNumber > includedRevisionRounds && (
                          <span className="ml-2 text-xs text-yellow-600 font-normal">(extra — chargeable)</span>
                        )}
                        {' · '}{formatDate(r.dateRequested)}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">{r.description}</p>
                    </div>
                    <Select
                      value={r.status ?? 'pending'}
                      onChange={e => handleUpdateRevisionStatus(r.id, e.target.value)}
                      className="w-36 h-8 text-xs shrink-0"
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

      <Dialog open={revisionDialog} onClose={() => setRevisionDialog(false)} title="Log Revision Round">
        <RevisionForm onSave={handleAddRevision} onClose={() => setRevisionDialog(false)} />
      </Dialog>
    </div>
  )
}
